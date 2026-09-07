import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getAllReports } from "@/lib/report";
import { parseWindow } from "@/lib/metrics";
import { accountsCsv, postsCsv } from "@/lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export?tipo=contas|posts&janela=30
 * Downloads a CSV of every account (default) or every post in the window.
 * Staff only.
 */
export async function GET(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const url = new URL(req.url);
  const kind = url.searchParams.get("tipo") === "posts" ? "posts" : "contas";
  const windowDays = parseWindow(url.searchParams.get("janela") ?? undefined);

  const { reports } = await getAllReports(windowDays);
  const body = kind === "posts" ? postsCsv(reports) : accountsCsv(reports);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `1043-${kind}-${windowDays}d-${stamp}.csv`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
