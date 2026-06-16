import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

function slugId(name: string): string {
  const base = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "creator"}-${crypto.randomBytes(2).toString("hex")}`;
}

// Create an influencer account. Returns the generated password ONCE.
export async function POST(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { name, email } = await req.json();
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  const exists = (await sql`select 1 from influencers where email = ${email}`)[0];
  if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const id = slugId(name);
  const password = crypto.randomBytes(6).toString("base64url"); // 8-char temp password
  await sql`insert into influencers (id, name, email, password_hash)
            values (${id}, ${name}, ${email}, ${hashPassword(password)})`;

  return NextResponse.json({
    id,
    name,
    email,
    password, // shown once — share it with the creator
    loginUrl: `${process.env.APP_URL}/login`,
  });
}
