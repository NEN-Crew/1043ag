import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { setInfluencerSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const row = (await sql`select id, password_hash from influencers where email = ${email}`)[0] as any;
  if (!row || !verifyPassword(password ?? "", row.password_hash)) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }
  setInfluencerSession(row.id);
  return NextResponse.json({ ok: true });
}
