import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { DELETE_REASONS, DeleteReason, HUNT_STATUSES, HuntPatch, deleteProfile, patchProfile } from "@/lib/hunt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const text = (v: unknown, max: number) => (v == null ? null : String(v).trim().slice(0, max) || null);

/** Staff only. Body: { status?, notes?, contact?, influencerId? }. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  const patch: HuntPatch = {};
  if (body.status !== undefined) {
    if (!(HUNT_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.notes !== undefined) patch.notes = text(body.notes, 4000);
  if (body.contact !== undefined) patch.contact = text(body.contact, 300);
  if (body.influencerId !== undefined) {
    const id = text(body.influencerId, 100);
    if (id) {
      const exists = (await sql`select 1 from influencers where id = ${id}`)[0];
      if (!exists) return NextResponse.json({ error: "Unknown creator" }, { status: 400 });
    }
    patch.influencerId = id;
  }

  const updated = await patchProfile(params.id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    status: updated.status,
    notes: updated.notes,
    contact: updated.contact,
    influencerId: updated.influencer_id,
  });
}

/** Staff only. Body: { reason }. Two of the reasons also suppress the handle. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!(DELETE_REASONS as readonly string[]).includes(body?.reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }
  const ok = await deleteProfile(params.id, body.reason as DeleteReason);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
