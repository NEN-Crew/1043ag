import { NextResponse } from "next/server";
import { getAdminId } from "@/lib/auth";
import { BadInput, cleanPatch, createDeal } from "@/lib/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/deals — register an orçamento. Staff only; creators read, they don't write. */
export async function POST(req: Request) {
  const admin = getAdminId();
  if (!admin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const deal = await createDeal(cleanPatch(body), admin);
    return NextResponse.json({ deal });
  } catch (e) {
    if (e instanceof BadInput) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
