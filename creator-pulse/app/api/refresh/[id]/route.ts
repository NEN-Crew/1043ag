import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { refreshInfluencer, getReport } from "@/lib/report";
import { isAdmin, getInfluencerId } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60; // refresh hits external APIs; give it room

const COOLDOWN_MS = 12 * 60 * 60 * 1000;

// The admin can refresh anyone, any time. An influencer can refresh
// themself at most once every 12 hours.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const admin = isAdmin();
  const self = getInfluencerId() === params.id;
  if (!admin && !self) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  if (!admin) {
    const row = (await sql`select last_manual_refresh_at from influencers where id = ${params.id}`)[0];
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const last = row.last_manual_refresh_at ? new Date(row.last_manual_refresh_at).getTime() : 0;
    const retryInMs = last + COOLDOWN_MS - Date.now();
    if (retryInMs > 0) {
      return NextResponse.json({ error: "Refreshed recently", retryInMs }, { status: 429 });
    }
    await sql`update influencers set last_manual_refresh_at = now() where id = ${params.id}`;
  }

  const refreshed = await refreshInfluencer(params.id);
  const report = await getReport(params.id);
  return NextResponse.json({ refreshed, report });
}
