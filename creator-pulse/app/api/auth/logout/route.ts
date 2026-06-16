import { NextResponse } from "next/server";
import { clearSessions } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  clearSessions();
  return NextResponse.json({ ok: true });
}
