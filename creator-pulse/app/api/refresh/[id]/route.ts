import { NextResponse } from "next/server";
import { refreshInfluencer, getReport } from "@/lib/report";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60; // refresh hits external APIs; give it room

// Only the admin can trigger a refresh.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  const refreshed = await refreshInfluencer(params.id);
  const report = await getReport(params.id);
  return NextResponse.json({ refreshed, report });
}
