/**
 * Turns the raw numbers we store into the handful of things an agency and a
 * creator actually decide on: is this audience engaged, do the posts get seen,
 * does anyone act on them, and does the creator show up consistently.
 *
 * Everything here is pure — same stats in, same analysis out — so it can run on
 * the server for both /me and /admin without another API round trip.
 */
import {
  CADENCE_ANCHORS,
  CPM,
  EFFORT_SHARE_ANCHORS,
  EFFORT_SHARE_ANCHORS_TIKTOK,
  MIN_POSTS_TO_SCORE,
  SENDS_PER_REACH_BAND,
  Tier,
  VIEW_RATE_ANCHORS,
  engagementAnchors,
  grade,
  scoreAt,
  tierFor,
} from "./benchmarks";

export type Platform = "instagram" | "tiktok";

export type Item = {
  id: string;
  url: string | null;
  thumb: string | null;
  caption: string;
  format: string;
  at: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  /** Saves + shares: the reactions that carry a post to new people. */
  sends: number | null;
  /** Every reaction we can see on this post. */
  interactions: number | null;
  /** Interactions ÷ reach (or views, when reach isn't available). */
  engagementByReach: number | null;
  /** (saves + shares) ÷ reach — the distribution signal. Instagram only. */
  sendsPerReach: number | null;
};

export type Component = {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  /** The measured number, formatted for display. */
  display: string;
  /** What normal looks like, so the score isn't a black box. */
  benchmark: string;
  /** One line of plain English: what this measures and what it's telling us. */
  note: string;
};

export type Analysis = {
  platform: Platform;
  handle: string | null;
  followers: number | null;
  tier: Tier;
  updatedAt: string | null;

  /** Median, not average — one viral post shouldn't set expectations. */
  typical: {
    views: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    interactions: number | null;
  };
  engagementRate: number | null;
  engagementByReach: number | null;
  viewRate: number | null;
  sendsPerReach: number | null;
  effortShare: number | null;
  cadence: number | null;

  score: number | null;
  grade: ReturnType<typeof grade>;
  components: Component[];
  headline: string;

  items: Item[];
  best: Item | null;
  formats: { name: string; posts: number; views: number | null; engagement: number | null }[];
  window: { days: number; posts: number } | null;
  /**
   * What a typical post's views would cost as bought media. A floor for a quote,
   * not a rate card — the CPM band is carried along so the assumption is visible.
   */
  mediaValue: { low: number; high: number; currency: string; cpm: [number, number] } | null;
  /** Set when the platform only gave us part of the picture. */
  caveat: string | null;
};

const pct = (n: number | null, d = 1) => (n == null ? "—" : `${n.toFixed(d)}%`);
const num = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function sum(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
}

function ratio(top: number | null, bottom: number | null | undefined): number | null {
  if (top == null || !bottom) return null;
  return (top / bottom) * 100;
}

// Instagram reports every video post as VIDEO or REELS; both are Reels today.
const IG_FORMATS: Record<string, string> = {
  IMAGE: "Photo",
  CAROUSEL_ALBUM: "Carousel",
  VIDEO: "Reel",
  REELS: "Reel",
};

function toItems(platform: Platform, stats: any): Item[] {
  const raw = (platform === "instagram" ? stats?.posts : stats?.videos) ?? [];
  return raw.map((p: any): Item => {
    const isIg = platform === "instagram";
    const likes = p.likes ?? null;
    const comments = p.comments ?? null;
    const saves = isIg ? p.saves ?? null : null;
    const shares = p.shares ?? null;
    const reach = isIg ? p.reach ?? null : null;
    const views = p.views ?? null;

    // Instagram's own total_interactions already folds in saves and shares;
    // fall back to adding up the parts when it's missing.
    const interactions = isIg
      ? p.totalInteractions ?? sum([likes, comments, saves, shares])
      : sum([likes, comments, shares]);

    const denominator = reach ?? views;
    const sends = sum([saves, shares]);

    return {
      id: String(p.id),
      url: (isIg ? p.permalink : p.shareUrl) ?? null,
      thumb: (isIg ? p.thumbnail : p.cover) ?? null,
      caption: ((isIg ? p.caption : p.title) || "Untitled").replace(/\s+/g, " ").trim(),
      format: isIg ? IG_FORMATS[p.type] ?? "Post" : "Video",
      at: (isIg ? p.timestamp : p.createTime ? new Date(p.createTime * 1000).toISOString() : null) ?? null,
      views,
      reach,
      likes,
      comments,
      saves,
      shares,
      sends,
      interactions,
      engagementByReach: ratio(interactions, denominator),
      sendsPerReach: isIg ? ratio(sends, reach) : null,
    };
  });
}

/** Posts per week across the span the posts actually cover. */
function cadenceOf(items: Item[]): { cadence: number | null; window: Analysis["window"] } {
  const times = items
    .map((i) => (i.at ? new Date(i.at).getTime() : null))
    .filter((t): t is number => t != null && Number.isFinite(t));
  if (times.length < 2) return { cadence: null, window: null };
  const newest = Math.max(...times);
  const oldest = Math.min(...times);
  const days = Math.max(1, (newest - oldest) / 86_400_000);
  return { cadence: (times.length / days) * 7, window: { days: Math.round(days), posts: times.length } };
}

function formatBreakdown(items: Item[]): Analysis["formats"] {
  const groups = new Map<string, Item[]>();
  for (const it of items) groups.set(it.format, [...(groups.get(it.format) ?? []), it]);
  return [...groups.entries()]
    // Two posts is the least that says anything; one is an anecdote.
    .filter(([, list]) => list.length >= 2)
    .map(([name, list]) => ({
      name,
      posts: list.length,
      views: median(list.map((i) => i.views)),
      engagement: median(list.map((i) => i.engagementByReach)),
    }))
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
}

export function analyze(platform: Platform, stats: any): Analysis | null {
  if (!stats) return null;

  const followers: number | null = stats.followers ?? null;
  const tier = tierFor(followers);
  const items = toItems(platform, stats);
  const { cadence, window } = cadenceOf(items);

  const typical = {
    views: median(items.map((i) => i.views)),
    reach: median(items.map((i) => i.reach)),
    likes: median(items.map((i) => i.likes)),
    comments: median(items.map((i) => i.comments)),
    interactions: median(items.map((i) => i.interactions)),
  };

  const engagementRate = ratio(typical.interactions, followers);
  const engagementByReach = median(items.map((i) => i.engagementByReach));
  const viewRate = ratio(typical.views, followers);
  const sendsPerReach = median(items.map((i) => i.sendsPerReach));

  // Share of reactions that cost the viewer something: a comment, a save, a
  // send to a friend. Likes are free; these are the ones platforms rank on.
  const totalInteractions = sum(items.map((i) => i.interactions));
  const totalEffort = sum(
    items.flatMap((i) => [i.comments, i.saves, i.shares].filter((v) => v != null))
  );
  const effortShare = ratio(totalEffort, totalInteractions);

  // Three posts is the floor. Rating an account off one post is a coin flip
  // dressed up as a number, so below the floor we show the measurements and
  // withhold the score rather than guess.
  const enough = items.length >= MIN_POSTS_TO_SCORE;

  const components: Component[] = [
    {
      key: "engagement",
      label: "Engagement",
      weight: 0.4,
      score: scoreAt(engagementRate, engagementAnchors(tier)),
      display: pct(engagementRate, 2),
      benchmark: `${tier.name}: ${tier.band[0]}–${tier.band[1]}%`,
      note: `Reactions on a typical post as a share of the ${num(followers)} followers. Graded against what's normal for a ${tier.name.toLowerCase()} account, because engagement falls as an audience grows.`,
    },
    {
      key: "reach",
      label: "Reach",
      weight: 0.25,
      score: scoreAt(viewRate, VIEW_RATE_ANCHORS),
      display: pct(viewRate),
      benchmark: "10% floor, 30% typical",
      note: `A typical post is seen ${num(typical.views)} times. This is the check on follower count: a big audience that never watches is worth less than a small one that does.`,
    },
    {
      key: "impact",
      label: "Impact",
      weight: 0.2,
      score: scoreAt(
        effortShare,
        platform === "instagram" ? EFFORT_SHARE_ANCHORS : EFFORT_SHARE_ANCHORS_TIKTOK
      ),
      display: pct(effortShare),
      benchmark: platform === "instagram" ? "8% normal, 20%+ strong" : "5% normal, 12%+ strong",
      note:
        platform === "instagram"
          ? "Share of reactions that were comments, saves or shares rather than likes. A send is worth roughly 3–5 likes to the algorithm, so this is what moves a post beyond the existing audience."
          : "Share of reactions that were comments or shares rather than likes. Cheap likes inflate a rate; these don't.",
    },
    {
      key: "consistency",
      label: "Consistency",
      weight: 0.15,
      score: scoreAt(cadence, CADENCE_ANCHORS),
      display: cadence == null ? "—" : `${cadence.toFixed(1)}/wk`,
      benchmark: "3/wk strong",
      note: window
        ? `${window.posts} posts over the last ${window.days} days. Cadence is what makes delivery predictable when a campaign is booked.`
        : "Not enough dated posts yet to measure a rhythm.",
    },
  ];

  if (!enough) for (const c of components) c.score = null;

  // Re-weight across the components we could actually measure, so a missing
  // metric doesn't quietly drag the score down.
  const scored = components.filter((c) => c.score != null);
  const weight = scored.reduce((a, c) => a + c.weight, 0);
  const score = weight ? Math.round(scored.reduce((a, c) => a + c.score! * c.weight, 0) / weight) : null;

  const best =
    items.filter((i) => i.views != null || i.interactions != null).sort(
      (a, b) => (b.views ?? b.interactions ?? 0) - (a.views ?? a.interactions ?? 0)
    )[0] ?? null;

  const mediaValue =
    typical.views != null
      ? {
          low: (typical.views / 1000) * CPM.low,
          high: (typical.views / 1000) * CPM.high,
          currency: CPM.currency,
          cpm: [CPM.low, CPM.high] as [number, number],
        }
      : null;

  const withReach = items.filter((i) => i.reach != null).length;
  const caveat =
    platform === "instagram" && items.length > 0 && withReach < items.length
      ? `Reach and saves came back for ${withReach} of ${items.length} posts — Instagram doesn't report them for every media type.`
      : platform === "tiktok"
      ? "TikTok's API doesn't return reach or audience demographics, so those aren't shown."
      : null;

  return {
    platform,
    handle: stats.username ?? null,
    followers,
    tier,
    updatedAt: stats.updated_at ?? null,
    typical,
    engagementRate,
    engagementByReach,
    viewRate,
    sendsPerReach,
    effortShare,
    cadence,
    score,
    grade: grade(score),
    components,
    headline: enough
      ? headlineFor(components, score)
      : `Only ${items.length} recent post${items.length === 1 ? "" : "s"} to go on — the score appears at ${MIN_POSTS_TO_SCORE}.`,
    items,
    best,
    formats: formatBreakdown(items),
    window,
    mediaValue,
    caveat,
  };
}

/** One sentence naming the strongest and weakest thing about this account. */
function headlineFor(components: Component[], score: number | null): string {
  const scored = components.filter((c) => c.score != null);
  if (score == null || scored.length < 2) return "Not enough posts yet to rate this account.";
  const sorted = [...scored].sort((a, b) => b.score! - a.score!);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  if (top.score! - bottom.score! < 15) return `Even across the board — nothing stands out either way.`;
  return `${top.label} is the strength (${top.score}/100). ${bottom.label} is what's holding the score down (${bottom.score}/100).`;
}

export type Audience = {
  age: { key: string; pct: number }[];
  gender: { key: string; pct: number }[];
  country: { key: string; pct: number }[];
  /** e.g. "Mostly women, 25–34, in Brazil (61% of the audience)". */
  summary: string | null;
};

const GENDER_NAMES: Record<string, string> = { F: "Women", M: "Men", U: "Unspecified" };

/**
 * Instagram's follower_demographics come back as raw counts per breakdown.
 * Percentages are what a brief is actually written against.
 */
export function audienceFrom(demographics: any): Audience | null {
  if (!demographics) return null;

  const share = (rows: any[] | undefined) => {
    if (!rows?.length) return [];
    const total = rows.reduce((a, r) => a + (r.value ?? 0), 0);
    if (!total) return [];
    return rows
      .map((r) => ({ key: String(r.key), pct: ((r.value ?? 0) / total) * 100 }))
      .sort((a, b) => b.pct - a.pct);
  };

  // Age brackets are ordinal — they stay in their natural order, because a bar
  // chart of ages sorted by size is unreadable.
  const age = share(demographics.age).sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true }));
  const gender = share(demographics.gender).map((g) => ({ ...g, key: GENDER_NAMES[g.key] ?? g.key }));
  const country = share(demographics.country);
  if (!age.length && !gender.length && !country.length) return null;

  const biggest = (rows: { key: string; pct: number }[]) =>
    rows.length ? rows.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;

  const topAge = biggest(age);
  const parts: string[] = [];
  if (gender[0]) parts.push(`${Math.round(gender[0].pct)}% ${gender[0].key.toLowerCase()}`);
  if (topAge) parts.push(`mostly ${topAge.key}`);
  if (country[0]) parts.push(`${Math.round(country[0].pct)}% in ${country[0].key}`);

  return { age, gender, country, summary: parts.length ? parts.join(", ") : null };
}

/** One number per creator for the roster, weighted by where the audience is. */
export function overallScore(analyses: (Analysis | null)[]): number | null {
  const xs = analyses.filter((a): a is Analysis => a?.score != null);
  if (!xs.length) return null;
  const weight = xs.reduce((a, x) => a + Math.max(1, x.followers ?? 1), 0);
  return Math.round(
    xs.reduce((a, x) => a + x.score! * Math.max(1, x.followers ?? 1), 0) / weight
  );
}

export { SENDS_PER_REACH_BAND };
