import { NextResponse } from "next/server";
import { getAdminId, isAdmin } from "@/lib/auth";
import { parseHandle } from "@/lib/hunt-handle";
import { lookup } from "@/lib/hunt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Staff only. Body: { platform?, input }. See lib/hunt.ts#lookup for the contract. */
export async function POST(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const selected = body?.platform === "instagram" || body?.platform === "tiktok" ? body.platform : null;
  const parsed = parseHandle(String(body?.input ?? ""), selected);
  if (!parsed) return NextResponse.json({ status: "error", code: "invalid_handle" });

  const result = await lookup(parsed.platform, parsed.handle, getAdminId());
  return NextResponse.json({ ...result, platform: parsed.platform, handle: parsed.handle });
}
