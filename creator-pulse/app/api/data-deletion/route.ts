import { NextResponse } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

// Meta "Data Deletion Request" + "Deauthorize" callback.
//
// When a creator removes Pulse from their Instagram account (or asks Meta to
// delete their data), Meta POSTs form-encoded `signed_request=<sig>.<payload>`
// here. We verify the HMAC with the app secret, delete everything we hold
// from that Instagram account, log it, and answer with the JSON Meta expects:
// a status URL and a confirmation code.
// Docs: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback

function appUrl() {
  return (process.env.APP_URL ?? "").replace(/\/+$/, "");
}

function b64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseSignedRequest(signed: string, secret: string): { user_id?: string } | null {
  const dot = signed.indexOf(".");
  if (dot < 0) return null;
  const sig = b64url(signed.slice(0, dot));
  const payload = signed.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest();
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(b64url(payload).toString("utf8"));
    if (String(data.algorithm ?? "").toUpperCase() !== "HMAC-SHA256") return null;
    return data;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  let signed = "";
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    signed = String((await req.json().catch(() => ({})))?.signed_request ?? "");
  } else {
    signed = String((await req.formData().catch(() => null))?.get("signed_request") ?? "");
  }
  if (!signed) return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });

  const data = parseSignedRequest(signed, secret);
  if (!data?.user_id) return NextResponse.json({ error: "Bad signature" }, { status: 400 });

  const userId = String(data.user_id);
  const code = randomBytes(6).toString("hex").toUpperCase();

  // Every Pulse account that connected this Instagram user. Normally one.
  const rows = await sql`
    select influencer_id from connections
    where platform = 'instagram' and account_id = ${userId}`;
  const ids = rows.map((r: any) => r.influencer_id as string);

  for (const id of ids) {
    await sql`delete from instagram_stats_history where influencer_id = ${id}`;
    await sql`delete from instagram_stats where influencer_id = ${id}`;
    await sql`delete from connections where influencer_id = ${id} and platform = 'instagram'`;
  }

  await sql`
    insert into data_deletion_requests (confirmation_code, platform, platform_user_id, influencer_id, status)
    values (${code}, 'instagram', ${userId}, ${ids[0] ?? null}, ${ids.length ? "completed" : "no_data"})`;

  return NextResponse.json({
    url: `${appUrl()}/data-deletion?code=${code}`,
    confirmation_code: code,
  });
}

// Lets a reviewer (or us) confirm the endpoint is live.
export async function GET() {
  return NextResponse.json({ ok: true, accepts: "POST signed_request" });
}
