import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { refreshInfluencer } from "@/lib/report";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel Cron calls this daily (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when the env var is set.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const rows = await sql`select id from influencers`;
  const results: Record<string, string[]> = {};
  for (const r of rows as any[]) {
    results[r.id] = await refreshInfluencer(r.id);
  }
  return NextResponse.json({ ok: true, results });
}
