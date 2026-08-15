import { sql } from "./db";

/**
 * Follower history from the append-only snapshot tables. Growth is the one
 * number that needs time to appear, so everything here degrades to null rather
 * than inventing a trend from two days of data.
 */
export type Growth = {
  points: { at: string; followers: number }[];
  /** Change over the window, and the same as a percentage. Null until we have the history. */
  change7: number | null;
  change30: number | null;
  pct7: number | null;
  pct30: number | null;
  /** First snapshot we hold, so the UI can say how long it's been tracking. */
  since: string | null;
};

type Row = { influencer_id: string; followers: number | null; captured_at: string };

function build(rows: Row[]): Growth | null {
  const points = rows
    .filter((r) => r.followers != null)
    .map((r) => ({ at: new Date(r.captured_at).toISOString(), followers: r.followers as number }));
  if (!points.length) return null;

  const latest = points[points.length - 1];

  // Only claim an N-day change once a snapshot exists that is genuinely that
  // old — at least 60% of the window — otherwise the number flatters itself.
  const changeOver = (days: number): number | null => {
    const target = Date.now() - days * 86_400_000;
    const older = points.filter((p) => new Date(p.at).getTime() <= target);
    const base = older.length ? older[older.length - 1] : points[0];
    const age = (Date.now() - new Date(base.at).getTime()) / 86_400_000;
    if (age < days * 0.6) return null;
    return latest.followers - base.followers;
  };

  const change7 = changeOver(7);
  const change30 = changeOver(30);
  const asPct = (change: number | null) =>
    change == null || latest.followers - change <= 0 ? null : (change / (latest.followers - change)) * 100;

  return {
    points,
    change7,
    change30,
    pct7: asPct(change7),
    pct30: asPct(change30),
    since: points[0].at,
  };
}

export type GrowthByPlatform = { instagram: Growth | null; tiktok: Growth | null };

/** Growth for many creators in two queries, for the admin roster. */
export async function getGrowth(ids: string[]): Promise<Map<string, GrowthByPlatform>> {
  const out = new Map<string, GrowthByPlatform>();
  if (!ids.length) return out;

  const [igRows, ttRows] = await Promise.all([
    sql`select influencer_id, followers, captured_at from instagram_stats_history
        where influencer_id = any(${ids}::text[]) and captured_at > now() - interval '120 days'
        order by captured_at asc`,
    sql`select influencer_id, followers, captured_at from tiktok_stats_history
        where influencer_id = any(${ids}::text[]) and captured_at > now() - interval '120 days'
        order by captured_at asc`,
  ]);
  const ig = igRows as Row[];
  const tt = ttRows as Row[];

  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(r.influencer_id, [...(m.get(r.influencer_id) ?? []), r]);
    return m;
  };
  const igBy = group(ig);
  const ttBy = group(tt);

  for (const id of ids) {
    out.set(id, {
      instagram: build(igBy.get(id) ?? []),
      tiktok: build(ttBy.get(id) ?? []),
    });
  }
  return out;
}

export async function getGrowthFor(id: string): Promise<GrowthByPlatform> {
  return (await getGrowth([id])).get(id) ?? { instagram: null, tiktok: null };
}
