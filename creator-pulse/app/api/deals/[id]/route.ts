import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { BadInput, cleanPatch, deleteDeal, updateDeal } from "@/lib/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/deals/:id — any subset of fields; a status click sends one. Staff only. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const deal = await updateDeal(params.id, cleanPatch(body));
    if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ deal });
  } catch (e) {
    if (e instanceof BadInput) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const ok = await deleteDeal(params.id);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
