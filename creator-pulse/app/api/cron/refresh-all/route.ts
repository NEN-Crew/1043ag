import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { refreshInfluencer } from "@/lib/report";
import { purgeStaleProspects } from "@/lib/hunt";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Vercel Cron calls this daily (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" when the env var is set.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const configured = Boolean(process.env.CRON_SECRET);
  if (!configured || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    // `configured` says whether the deployment has a CRON_SECRET at all, which
    // separates "the env var is missing" from "your copy of it differs". It
    // reveals nothing about the value.
    return NextResponse.json({ error: "Not authorized", configured }, { status: 403 });
  }

  // Hunt retention: one cheap delete of prospects idle for 12 months. The cron
  // never re-fetches hunt profiles; those only refresh when someone opens them.
  const purged = await purgeStaleProspects().catch((err) => {
    console.error("hunt purge failed:", err);
    return 0;
  });

  const rows = await sql`select id from influencers`;
  const results: Record<string, string[]> = {};
  for (const r of rows as any[]) {
    results[r.id] = await refreshInfluencer(r.id);
  }
  return NextResponse.json({ ok: true, results, huntPurged: purged });
}
