import { sql } from "./db";
import { Delta, HistoryInput, delta } from "./metrics";

/**
 * Trends from the append-only snapshot tables. Growth and period-over-period
 * comparison are the two things that need time to exist, so everything here
 * returns null rather than inventing a trend from two days of data.
 */

type Row = {
  influencer_id: string;
  followers: number | null;
  captured_at: string;
  post_metrics?: any[] | null;
  video_metrics?: any[] | null;
};

function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/**
 * Engagement rate at the moment a snapshot was taken, over the same window the
 * page is showing. Without the window the chart would plot a different ER from
 * the headline — same name, different set of posts.
 */
function erAt(row: Row, platform: "instagram" | "tiktok", windowDays: number): number | null {
  const all = (platform === "instagram" ? row.post_metrics : row.video_metrics) ?? [];
  const cutoff = new Date(row.captured_at).getTime() - windowDays * 864e5;
  const items = all.filter((m: any) => {
    const at = platform === "instagram" ? Date.parse(m.timestamp ?? "") : (m.createTime ?? 0) * 1000;
    return Number.isFinite(at) && at >= cutoff;
  });
  if (!items.length || !row.followers) return null;
  // Same formula as the live view — the sum of the parts, never Instagram's
  // total_interactions. If these diverged, the chart would step on the day the
  // formula changed rather than on the day the account did.
  const interactions = items.map((m: any) => add([m.likes, m.comments, m.saves, m.shares]));
  const typical = median(interactions);
  return typical == null ? null : (typical / row.followers) * 100;
}

function add(xs: (number | null | undefined)[]): number | null {
  const ok = xs.filter((v): v is number => v != null && Number.isFinite(v));
  return ok.length ? ok.reduce((a, b) => a + b, 0) : null;
}

/** The cron runs daily but manual refreshes add extra rows; keep one per day. */
function oncePerDay(rows: Row[]): Row[] {
  const byDay = new Map<string, Row>();
  for (const r of rows) byDay.set(new Date(r.captured_at).toISOString().slice(0, 10), r);
  return [...byDay.values()].sort(
    (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
  );
}

function build(rows: Row[], platform: "instagram" | "tiktok", windowDays: number): HistoryInput {
  const daily = oncePerDay(rows);

  const followerPoints = daily
    .filter((r) => r.followers != null)
    .map((r) => ({ at: new Date(r.captured_at).getTime(), value: r.followers as number }));

  const erPoints = daily
    .map((r) => ({ at: new Date(r.captured_at).getTime(), value: erAt(r, platform, windowDays) }))
    .filter((p): p is { at: number; value: number } => p.value != null);

  /**
   * Only claim an N-day change once a snapshot exists that is genuinely that
   * old — at least 60% of the window — otherwise the number flatters itself.
   */
  const changeOver = (points: { at: number; value: number }[], days: number) => {
    if (points.length < 2) return null;
    const latest = points[points.length - 1];
    const target = Date.now() - days * 86_400_000;
    const older = points.filter((p) => p.at <= target);
    const base = older.length ? older[older.length - 1] : points[0];
    if ((Date.now() - base.at) / 86_400_000 < days * 0.6) return null;
    return { from: base.value, to: latest.value };
  };

  const followerChange = changeOver(followerPoints, 30);
  const erChange = changeOver(erPoints, 30);

  const growthPct =
    followerChange && followerChange.from > 0
      ? ((followerChange.to - followerChange.from) / followerChange.from) * 100
      : null;

  const dated = (points: { at: number; value: number }[]) =>
    points.map((p) => ({ at: new Date(p.at).toISOString(), value: p.value }));

  return {
    followerTrend: dated(followerPoints),
    // Followers are a count, so its delta is a percentage.
    followerDelta: delta(growthPct, "pct"),
    erTrend: dated(erPoints),
    // Engagement is already a rate, so its delta is in percentage points.
    erDelta: erChange ? (delta(erChange.to - erChange.from, "pp") as Delta) : null,
    growthPct,
  };
}

export type HistoryByPlatform = { instagram: HistoryInput; tiktok: HistoryInput };

const EMPTY: HistoryInput = {
  followerTrend: [],
  followerDelta: null,
  erTrend: [],
  erDelta: null,
  growthPct: null,
};

/** History for many creators in two queries, for the agency roster. */
export async function getHistory(
  ids: string[],
  windowDays: number = 30
): Promise<Map<string, HistoryByPlatform>> {
  const out = new Map<string, HistoryByPlatform>();
  if (!ids.length) return out;

  const [igRows, ttRows] = await Promise.all([
    sql`select influencer_id, followers, captured_at, post_metrics
        from instagram_stats_history
        where influencer_id = any(${ids}::text[]) and captured_at > now() - interval '400 days'
        order by captured_at asc`,
    sql`select influencer_id, followers, captured_at, video_metrics
        from tiktok_stats_history
        where influencer_id = any(${ids}::text[]) and captured_at > now() - interval '400 days'
        order by captured_at asc`,
  ]);

  const group = (rows: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(r.influencer_id, [...(m.get(r.influencer_id) ?? []), r]);
    return m;
  };
  const igBy = group(igRows as Row[]);
  const ttBy = group(ttRows as Row[]);

  for (const id of ids) {
    out.set(id, {
      instagram: build(igBy.get(id) ?? [], "instagram", windowDays),
      tiktok: build(ttBy.get(id) ?? [], "tiktok", windowDays),
    });
  }
  return out;
}

export const emptyHistory: HistoryByPlatform = { instagram: EMPTY, tiktok: EMPTY };
