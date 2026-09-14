import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { clearSessions, setAdminSession, setInfluencerSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * One login form for everyone. Creators land on /me; agency staff (rows in
 * `admins`) land on /admin. The response says where, so the form doesn't have
 * to know which kind of account it just signed in.
 */
export async function POST(req: Request) {
  const { email, password, remember } = await req.json();
  const keep = remember !== false;
  const needle = String(email ?? "").trim().toLowerCase();

  const inf = (await sql`select id, password_hash from influencers where lower(email) = ${needle}`)[0] as any;
  if (inf && verifyPassword(password ?? "", inf.password_hash)) {
    clearSessions();
    setInfluencerSession(inf.id, keep);
    return NextResponse.json({ ok: true, redirect: "/me" });
  }

  const adm = (await sql`select id, password_hash from admins where lower(email) = ${needle}`)[0] as any;
  if (adm && verifyPassword(password ?? "", adm.password_hash)) {
    clearSessions();
    setAdminSession(adm.id, keep);
    return NextResponse.json({ ok: true, redirect: "/admin" });
  }

  return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
}
