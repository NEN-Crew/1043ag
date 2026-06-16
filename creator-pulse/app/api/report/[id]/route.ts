import { NextResponse } from "next/server";
import { getReport } from "@/lib/report";
import { isAdmin, getInfluencerId } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Admin sees anyone; an influencer sees only their own report.
  if (!isAdmin() && getInfluencerId() !== params.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const report = await getReport(params.id);
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(report);
}
