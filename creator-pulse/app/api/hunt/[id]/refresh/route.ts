import { NextResponse } from "next/server";
import { getAdminId, isAdmin } from "@/lib/auth";
import { refreshProfile } from "@/lib/hunt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Staff only. Body: { auto?: boolean }. The server decides whether a copy is
 * stale or inside the cooldown; the button state in the UI is a hint, not
 * the rule.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const result = await refreshProfile(params.id, { auto: Boolean(body?.auto), by: getAdminId() });
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
