/**
 * The agency-only insights screen: everything the discovery found the
 * database already knows but the dashboard never says. When to publish, which
 * format carries the account, how fast a post closes, what the profile reaches
 * on days without a post, and which posts brought followers.
 *
 * Pure, like metrics.ts: a platform view plus the raw daily snapshots in,
 * a view model out. Every cut respects MIN_CELL — a median of two posts is
 * not a reading, and a blank cell is more honest than a number with no sample.
 */
import type { PlatformView, Post } from "./metrics";

export type HistoryRow = {
  captured_at: string | Date;
  followers: number | null;
  post_metrics?: any[] | null;
  video_metrics?: any[] | null;
  account_insights?: { period?: string; metrics?: Record<string, number | null> } | null;
};

/** Below this many posts a cell stays blank rather than reporting noise. */
export const MIN_CELL = 3;

const TZ = "America/Sao_Paulo";
const DAY = 864e5;

function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function mean(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function sum(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
}

const at = (v: string | Date) => new Date(v).getTime();
const iso = (v: string | Date) => new Date(v).toISOString();
const interactionsOf = (p: Post) => sum([p.likes, p.comments, p.saves, p.shares]);
const reachOf = (p: Post, isIg: boolean) => (isIg ? p.reach ?? p.views : p.views);

// Weekday and hour in Brasília time: a post at 22h in São Paulo is the next
// day in UTC, and "quarta" has to mean the creator's Wednesday.
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LABELS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const weekdayOf = (v: string) => DOW.indexOf(new Date(v).toLocaleDateString("en-US", { weekday: "short", timeZone: TZ }));
const hourOf = (v: string) =>
  Number(new Date(v).toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }).slice(0, 2));

export type Bucket = {
  key: string;
  label: string;
  n: number;
  /** Null when n < MIN_CELL. */
  er: number | null;
  reach: number | null;
  saves: number | null;
  shares: number | null;
};

function bucket(key: string, label: string, items: Post[], isIg: boolean): Bucket {
  const ok = items.length >= MIN_CELL;
  return {
    key,
    label,
    n: items.length,
    er: ok ? median(items.map((p) => p.er)) : null,
    reach: ok ? median(items.map((p) => reachOf(p, isIg))) : null,
    saves: ok && isIg ? median(items.map((p) => p.saves)) : null,
    shares: ok ? median(items.map((p) => p.shares)) : null,
  };
}

export type Velocity = {
  /** Posts watched from day zero for at least seven days. */
  n: number;
  /** Median share of the final reactions reached by each checkpoint. */
  at: { d1: number | null; d2: number | null; d3: number | null; d7: number | null };
  /** Posts still growing more than 10% after their third day. */
  climbing: { post: Post; growth: number; days: number }[];
  /** When the snapshots began, so an empty state can say when the curve starts. */
  since: string | null;
};

export type DailyReach = {
  points: { at: string; reach: number; views: number | null; engaged: number | null }[];
  avgReach: number | null;
  avgEngaged: number | null;
  best: { at: string; reach: number } | null;
};

export type Growth = {
  deltas: { at: string; delta: number; posted: boolean }[];
  total: number | null;
  perDay: number | null;
  topDays: { at: string; delta: number; posts: Post[] }[];
  /** Followers gained in the 48h after each post, best first. */
  postGains: { post: Post; gain: number }[];
};

export type Insights = {
  platform: PlatformView["platform"];
  isIg: boolean;
  posts: number;
  weekday: Bucket[];
  slots: Bucket[];
  formats: Bucket[];
  hashtags: Bucket[];
  concentration: {
    unit: "reações" | "views";
    topCount: number;
    total: number;
    topShare: number | null;
    er: number | null;
    erWithoutViral: number | null;
    virals: number;
  };
  cadence: { perWeek: number | null; medianGap: number | null; maxGap: number | null; lastPostAt: string | null };
  velocity: Velocity;
  dailyReach: DailyReach | null;
  growth: Growth;
};

/** The cron runs once a day but manual refreshes add rows; keep the last per day. */
function oncePerDay(rows: HistoryRow[]): HistoryRow[] {
  const byDay = new Map<string, HistoryRow>();
  for (const r of rows) byDay.set(iso(r.captured_at).slice(0, 10), r);
  return [...byDay.values()].sort((a, b) => at(a.captured_at) - at(b.captured_at));
}

function velocity(rows: HistoryRow[], posts: Post[], isIg: boolean): Velocity {
  type Pt = { t: number; v: number };
  const series = new Map<string, Pt[]>();

  for (const r of rows) {
    const captured = at(r.captured_at);
    for (const m of (isIg ? r.post_metrics : r.video_metrics) ?? []) {
      const t0 = isIg ? Date.parse(m.timestamp ?? "") : (m.createTime ?? 0) * 1000;
      const v = sum([m.likes, m.comments, m.saves, m.shares]);
      if (!Number.isFinite(t0) || !t0 || v == null) continue;
      const list = series.get(String(m.id)) ?? [];
      list.push({ t: (captured - t0) / DAY, v });
      series.set(String(m.id), list);
    }
  }

  const valueAt = (pts: Pt[], day: number) => {
    const before = pts.filter((p) => p.t <= day);
    return before.length ? before[before.length - 1].v : null;
  };

  const fractions = { d1: [] as number[], d2: [] as number[], d3: [] as number[], d7: [] as number[] };
  const climbing: Velocity["climbing"] = [];
  const byId = new Map(posts.map((p) => [p.id, p]));

  for (const [id, pts] of series) {
    pts.sort((a, b) => a.t - b.t);
    // Only posts we caught within their first day and a half count: a post
    // first seen on day four has no curve to speak of.
    if (pts[0].t > 1.5) continue;
    const last = pts[pts.length - 1];
    if (last.t >= 7 && last.v > 0) {
      for (const [k, d] of [["d1", 1], ["d2", 2], ["d3", 3], ["d7", 7]] as const) {
        const v = valueAt(pts, d);
        if (v != null) fractions[k].push((v / last.v) * 100);
      }
    }
    const v3 = valueAt(pts, 3.5);
    const post = byId.get(id);
    if (post && last.t >= 5 && v3 && last.v / v3 - 1 >= 0.1) {
      climbing.push({ post, growth: (last.v / v3 - 1) * 100, days: Math.round(last.t) });
    }
  }

  return {
    n: fractions.d7.length,
    at: { d1: median(fractions.d1), d2: median(fractions.d2), d3: median(fractions.d3), d7: median(fractions.d7) },
    climbing: climbing.sort((a, b) => b.growth - a.growth).slice(0, 3),
    since: rows.length ? iso(rows[0].captured_at) : null,
  };
}

function dailyReach(rows: HistoryRow[], from: number): DailyReach | null {
  const byDay = new Map<string, DailyReach["points"][number]>();
  for (const r of rows) {
    const m = r.account_insights?.metrics;
    if (!m || m.reach == null) continue;
    byDay.set(iso(r.captured_at).slice(0, 10), {
      at: iso(r.captured_at),
      reach: m.reach,
      views: m.views ?? null,
      engaged: m.accounts_engaged ?? null,
    });
  }
  const points = [...byDay.values()].filter((p) => at(p.at) >= from).sort((a, b) => at(a.at) - at(b.at));
  if (!points.length) return null;
  const best = points.reduce((a, b) => (b.reach > a.reach ? b : a));
  return {
    points,
    avgReach: mean(points.map((p) => p.reach)),
    avgEngaged: mean(points.map((p) => p.engaged)),
    best: { at: best.at, reach: best.reach },
  };
}

function growth(rows: HistoryRow[], posts: Post[], from: number): Growth {
  const daily = oncePerDay(rows.filter((r) => r.followers != null));
  const dated = posts.filter((p) => p.postedAt).map((p) => ({ p, t: at(p.postedAt!) }));

  const deltas: Growth["deltas"] = [];
  const topDays: Growth["topDays"] = [];
  for (let i = 1; i < daily.length; i++) {
    const t = at(daily[i].captured_at);
    if (t < from) continue;
    const prev = at(daily[i - 1].captured_at);
    // A snapshot at 06h mostly reflects the day before, so a delta is tied
    // to the posts published between the two snapshots it spans.
    const between = dated.filter((d) => d.t >= prev && d.t < t).map((d) => d.p);
    const delta = (daily[i].followers as number) - (daily[i - 1].followers as number);
    deltas.push({ at: iso(daily[i].captured_at), delta, posted: between.length > 0 });
    topDays.push({ at: iso(daily[i].captured_at), delta, posts: between });
  }

  const postGains: Growth["postGains"] = [];
  for (const { p, t } of dated) {
    const base = [...daily].reverse().find((r) => at(r.captured_at) <= t);
    const after = daily.find((r) => at(r.captured_at) >= t + 2 * DAY);
    if (base && after) postGains.push({ post: p, gain: (after.followers as number) - (base.followers as number) });
  }

  const inWindow = daily.filter((r) => at(r.captured_at) >= from);
  const total =
    inWindow.length >= 2
      ? (inWindow[inWindow.length - 1].followers as number) - (inWindow[0].followers as number)
      : null;

  return {
    deltas,
    total,
    perDay: mean(deltas.map((d) => d.delta)),
    topDays: topDays.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
    postGains: postGains.sort((a, b) => b.gain - a.gain).slice(0, 3),
  };
}

export function buildInsights(view: PlatformView, rows: HistoryRow[], windowDays: number): Insights {
  const isIg = view.platform === "instagram";
  const posts = view.content.all;
  const from = Date.now() - windowDays * DAY;
  const dated = posts.filter((p) => p.postedAt);

  const weekday = WEEKDAY_LABELS.map((label, i) =>
    bucket(String(i), label, dated.filter((p) => weekdayOf(p.postedAt!) === i), isIg)
  );

  const slotOf = (h: number) => (h < 12 ? "manhã" : h < 18 ? "tarde" : "noite");
  const slots = (["manhã", "tarde", "noite"] as const).map((s) =>
    bucket(s, s === "manhã" ? "manhã · até 12h" : s === "tarde" ? "tarde · 12 a 18h" : "noite · 18h+",
      dated.filter((p) => slotOf(hourOf(p.postedAt!)) === s), isIg)
  );

  const formats = isIg
    ? (["reel", "carousel", "photo"] as const)
        .map((f) => {
          const items = posts.filter((p) => p.format === f);
          return items.length ? bucket(f, items[0].formatLabel, items, isIg) : null;
        })
        .filter((b): b is Bucket => b != null)
    : [];

  const tagCount = (p: Post) => (p.caption.match(/#\w+/g) ?? []).length;
  const hashtags = [
    bucket("0", "sem hashtag", posts.filter((p) => tagCount(p) === 0), isIg),
    bucket("1-3", "1 a 3 hashtags", posts.filter((p) => tagCount(p) >= 1 && tagCount(p) <= 3), isIg),
    bucket("4+", "4 ou mais", posts.filter((p) => tagCount(p) >= 4), isIg),
  ];

  // Concentration is measured on what the platform distributes: reactions on
  // Instagram, views on TikTok, where the For You page decides who sees what.
  const weight = (p: Post) => (isIg ? interactionsOf(p) : p.views);
  const weighted = posts.filter((p) => weight(p) != null).sort((a, b) => weight(b)! - weight(a)!);
  const topCount = Math.ceil(weighted.length * 0.2);
  const all = sum(weighted.map(weight));
  const top = sum(weighted.slice(0, topCount).map(weight));
  const nonViral = posts.filter((p) => p.standout !== "viral");
  const erWithoutViral = isIg
    ? view.followers
      ? ((median(nonViral.map(interactionsOf)) ?? 0) / view.followers) * 100
      : null
    : (() => {
        const i = median(nonViral.map(interactionsOf));
        const v = median(nonViral.map((p) => p.views));
        return i != null && v ? (i / v) * 100 : null;
      })();

  const times = dated.map((p) => at(p.postedAt!)).sort((a, b) => a - b);
  const gaps = times.slice(1).map((t, i) => (t - times[i]) / DAY);

  return {
    platform: view.platform,
    isIg,
    posts: posts.length,
    weekday,
    slots,
    formats,
    hashtags,
    concentration: {
      unit: isIg ? "reações" : "views",
      topCount,
      total: weighted.length,
      topShare: all && top != null ? (top / all) * 100 : null,
      er: view.engagement.rate,
      erWithoutViral: posts.some((p) => p.standout === "viral") ? erWithoutViral : null,
      virals: posts.filter((p) => p.standout === "viral").length,
    },
    cadence: {
      perWeek: view.postsPerWeek,
      medianGap: median(gaps),
      maxGap: gaps.length ? Math.max(...gaps) : null,
      lastPostAt: view.window.lastPostAt,
    },
    velocity: velocity(rows, posts, isIg),
    dailyReach: isIg ? dailyReach(rows, from) : null,
    growth: growth(rows, posts, from),
  };
}
