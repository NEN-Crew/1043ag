import { NextResponse } from "next/server";
import { setAdminSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  setAdminSession();
  return NextResponse.json({ ok: true });
}
