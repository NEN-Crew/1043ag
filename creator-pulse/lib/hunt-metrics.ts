/**
 * The prospect page's view model. Everything numeric comes out of
 * `analyze()` in lib/metrics.ts, run on a stats-like object built from a
 * hunt row, so a prospect's "er" is the roster's formula and never a second
 * one. What this file adds is the framing a prospect needs and a creator
 * doesn't: the roster comparison, the publi split, the bets scan, the
 * snapshot growth and the price references.
 *
 * Instagram's public ER is likes + comments over followers. Saves and shares
 * are private, so it is not the roster ER, and the page says so everywhere
 * the number appears ("er público"). For the comparison, roster Instagram
 * posts are run through the same function with their private fields set to
 * null, so both sides of the line are público.
 */
import { sql } from "./db";
import { POST_CAP, Platform, PlatformView, Post, analyze, isPaid } from "./metrics";
import { Tier, tierFor } from "./benchmarks";
import { Cadence, cadenceOf } from "./insights";
import { listDeals } from "./deals";
import { pricingByCreator } from "./commercial";
import { BetsHit, scanBets } from "./hunt-flags";
import { HuntProfile, HuntSnapshot, cooldownLeft, isStale } from "./hunt";
import { profileUrl } from "./hunt-handle";

import { HUNT_DEFAULT_WINDOW } from "./hunt-status";
export { HUNT_DEFAULT_WINDOW };

export type ProspectPost = Post & {
  /** `isPaid()` on the caption, or the platform's own paid flag (TikTok). */
  paid: boolean;
  /** TikTok public saves. Shown, never in the ER. */
  collects: number | null;
};

export type Comparison = {
  /** Median prospect-comparable ER of connected roster accounts. */
  median: number;
  /** How many accounts are behind that median. */
  count: number;
  tier: string;
  /** Fewer than 3 roster accounts in the tier, so every roster account on the network was used. */
  allTiers: boolean;
};

export type Prospect = {
  id: string;
  platform: Platform;
  platformLabel: string;
  handle: string;
  name: string;
  displayName: string | null;
  bio: string | null;
  link: string | null;
  avatarUrl: string | null;
  verified: boolean | null;
  likesHidden: boolean;
  followers: number | null;
  following: number | null;
  mediaCount: number | null;
  likesTotal: number | null;
  profileUrl: string;
  source: string | null;
  sourceLabel: string;
  fetchedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  stale: boolean;
  cooldownLeftMs: number;
  status: HuntProfile["status"];
  notes: string | null;
  contact: string | null;
  linked: { influencerId: string; name: string; connected: boolean } | null;
  tier: Tier;

  window: PlatformView["window"];
  engagement: { rate: number | null; comparison: Comparison | null };
  delivery: {
    views: number | null;
    /** Posts that carry a view count (Reels on Instagram, every video on TikTok). */
    withViews: number;
    viewRate: number | null;
    mediaValue: PlatformView["mediaValue"];
    shares: number | null;
    collects: number | null;
  };
  rhythm: Cadence & {
    formats: { key: string; label: string; pct: number }[] | null;
    /** The 60-post cap cut the window short; the period is only partly covered. */
    cappedSince: string | null;
  };
  publis: {
    count: number;
    share: number | null;
    erPaid: number | null;
    erOrganic: number | null;
    posts: ProspectPost[];
  };
  bets: { hits: BetsHit[]; scannedPosts: number };
  /** The latest 12 posts, newest first. */
  posts: ProspectPost[];
  growth: {
    firstSeenAt: string | null;
    delta: number | null;
    series: number[];
    snapshots: number;
  };
  price: {
    mediaValue: PlatformView["mediaValue"];
    closed: { median: number; jobs: number; creators: number } | null;
  };
};

const SOURCE_LABEL: Record<string, string> = {
  meta_business_discovery: "API oficial do Instagram",
  scrapecreators: "ScrapeCreators",
};

function median(values: (number | null | undefined)[]): number | null {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** The stats-like object `analyze()` expects, from a hunt row. */
export function statsOf(p: HuntProfile) {
  const base = {
    username: p.handle,
    avatar_url: p.avatar_url,
    updated_at: p.fetched_at,
    followers: p.followers,
    following: p.following,
    likes_total: p.likes_total,
  };
  return p.platform === "instagram"
    ? { ...base, media_count: p.media_count, posts: p.posts }
    : { ...base, video_count: p.media_count, videos: p.posts };
}

/**
 * A roster Instagram row with its private fields removed, so it measures
 * exactly what Business Discovery can see. TikTok rows pass through: the
 * roster formula already uses only public counts there.
 */
function asPublic(platform: Platform, stats: any) {
  if (platform !== "instagram") return stats;
  return {
    ...stats,
    posts: (stats.posts ?? []).map((x: any) => ({ ...x, saves: null, shares: null, reach: null, views: null })),
  };
}

/** The prospect-comparable ER of one account, or null when the window is empty. */
export function publicRate(platform: Platform, stats: any, windowDays: number): number | null {
  const v = analyze(platform, asPublic(platform, stats), null, windowDays);
  return v?.window.posts ? v.engagement.rate : null;
}

type RosterRow = { influencer_id: string; followers: number | null; stats: any };

/** Connected roster accounts on one network, with their stats rows. */
async function rosterOn(platform: Platform): Promise<RosterRow[]> {
  const rows =
    platform === "instagram"
      ? await sql`select s.* from instagram_stats s join connections c
                  on c.influencer_id = s.influencer_id and c.platform = 'instagram'`
      : await sql`select s.* from tiktok_stats s join connections c
                  on c.influencer_id = s.influencer_id and c.platform = 'tiktok'`;
  return (rows as any[]).map((r) => ({ influencer_id: r.influencer_id, followers: r.followers, stats: r }));
}

function compare(platform: Platform, tier: Tier, roster: RosterRow[], windowDays: number): Comparison | null {
  const rated = roster
    .map((r) => ({ tier: tierFor(r.followers), rate: publicRate(platform, r.stats, windowDays) }))
    .filter((r): r is { tier: Tier; rate: number } => r.rate != null);
  const same = rated.filter((r) => r.tier.name === tier.name);
  const pool = same.length >= 3 ? same : rated;
  const m = median(pool.map((r) => r.rate));
  if (m == null) return null;
  return { median: m, count: pool.length, tier: tier.name, allTiers: same.length < 3 };
}

/**
 * What 1043 actually closed for creators like this one: the median of each
 * creator's closed average, on the same network and tier. Hidden without
 * closed deals, since a median of nothing is not a reference.
 */
async function closedPrices(platform: Platform, tier: Tier, roster: RosterRow[]) {
  const ids = new Set(roster.filter((r) => tierFor(r.followers).name === tier.name).map((r) => r.influencer_id));
  if (!ids.size) return null;
  const pricing = pricingByCreator(await listDeals()).filter((p) => ids.has(p.influencerId) && p.closed);
  const m = median(pricing.map((p) => p.closed!.avg));
  if (m == null) return null;
  return { median: m, jobs: pricing.reduce((a, p) => a + p.approved, 0), creators: pricing.length };
}

const FORMAT_LABEL: Record<string, string> = { reel: "reels", carousel: "carrosséis", photo: "fotos" };

export async function buildProspect(
  p: HuntProfile,
  snapshots: HuntSnapshot[],
  windowDays: number = HUNT_DEFAULT_WINDOW
): Promise<Prospect> {
  const isIg = p.platform === "instagram";
  const view = analyze(p.platform, statsOf(p), null, windowDays)!;
  const tier = tierFor(p.followers);

  const [roster, linkedRow] = await Promise.all([
    rosterOn(p.platform),
    p.influencer_id
      ? sql`select i.name, exists(select 1 from connections c where c.influencer_id = i.id) as connected
            from influencers i where i.id = ${p.influencer_id}`
      : Promise.resolve([] as any[]),
  ]);

  // Paid flags come from the raw row; analyze() only knows the caption.
  const flagged = new Set(p.posts.filter((x: any) => x.paidFlag).map((x: any) => String(x.id)));
  const collectsBy = new Map(p.posts.map((x: any) => [String(x.id), x.collects ?? null]));
  const decorate = (post: Post): ProspectPost => ({
    ...post,
    paid: isPaid(post) || flagged.has(post.id),
    collects: collectsBy.get(post.id) ?? null,
  });

  // Hidden likes: an ER from comments alone would mislead, so none is shown.
  const all = view.content.all.map(decorate).map((x) => (p.likes_hidden ? { ...x, er: null } : x));
  const rate = p.likes_hidden ? null : view.engagement.rate;

  const paid = all.filter((x) => x.paid);
  const organic = all.filter((x) => !x.paid);
  const enoughSplit = paid.length >= 3 && organic.length >= 3;

  const latest = [...all]
    .filter((x) => x.postedAt)
    .sort((a, b) => Date.parse(b.postedAt!) - Date.parse(a.postedAt!))
    .slice(0, 12);

  const withViews = all.filter((x) => x.views != null).length;
  // Instagram views exist only for Reels; under three the median is a guess.
  const views = isIg && withViews < 3 ? null : view.typical.views;
  const viewRate = views != null && p.followers ? (views / p.followers) * 100 : null;
  const mediaValue = views != null ? view.mediaValue : null;

  const formats = isIg
    ? Object.entries(
        all.reduce<Record<string, number>>((acc, x) => ((acc[x.format] = (acc[x.format] ?? 0) + 1), acc), {})
      )
        .map(([key, n]) => ({ key, label: FORMAT_LABEL[key] ?? key, pct: (n / all.length) * 100 }))
        .sort((a, b) => b.pct - a.pct)
    : null;

  // Same rule as periodSeries(): 60 posts held and the oldest is inside the window.
  const held = p.posts
    .map((x: any) => Date.parse(isIg ? x.timestamp : x.createTime ? new Date(x.createTime * 1000).toISOString() : ""))
    .filter(Number.isFinite);
  const oldest = held.length ? Math.min(...held) : null;
  const cappedSince =
    p.posts.length >= POST_CAP && oldest != null && oldest > Date.parse(view.window.from)
      ? new Date(oldest).toISOString()
      : null;

  const bets = scanBets({
    bio: p.bio,
    link: p.link,
    profileUrl: profileUrl(p.platform, p.handle),
    posts: view.content.all.map((x) => ({ caption: x.caption, postedAt: x.postedAt, permalink: x.permalink })),
  });

  const followersSeries = snapshots.map((s) => s.followers).filter((n): n is number => n != null);
  const first = snapshots[0] ?? null;

  const name = p.display_name?.trim() || `@${p.handle}`;
  const linked = linkedRow[0]
    ? { influencerId: p.influencer_id!, name: String(linkedRow[0].name), connected: Boolean(linkedRow[0].connected) }
    : null;

  return {
    id: p.id,
    platform: p.platform,
    platformLabel: isIg ? "Instagram" : "TikTok",
    handle: p.handle,
    name,
    displayName: p.display_name,
    bio: p.bio,
    link: p.link,
    avatarUrl: p.avatar_url,
    verified: p.verified,
    likesHidden: p.likes_hidden,
    followers: p.followers,
    following: p.following,
    mediaCount: p.media_count,
    likesTotal: p.likes_total,
    profileUrl: profileUrl(p.platform, p.handle),
    source: p.source,
    sourceLabel: SOURCE_LABEL[p.source ?? ""] ?? "fonte pública",
    fetchedAt: p.fetched_at,
    lastError: p.last_error,
    lastErrorAt: p.last_error_at,
    stale: isStale(p),
    cooldownLeftMs: cooldownLeft(p),
    status: p.status,
    notes: p.notes,
    contact: p.contact,
    linked,
    tier,

    window: view.window,
    engagement: { rate, comparison: rate == null ? null : compare(p.platform, tier, roster, windowDays) },
    delivery: {
      views,
      withViews,
      viewRate,
      mediaValue,
      shares: isIg ? null : median(all.map((x) => x.shares)),
      collects: isIg ? null : median(all.map((x) => x.collects)),
    },
    rhythm: { ...cadenceOf(view), formats, cappedSince },
    publis: {
      count: paid.length,
      share: all.length ? (paid.length / all.length) * 100 : null,
      erPaid: enoughSplit && !p.likes_hidden ? median(paid.map((x) => x.er)) : null,
      erOrganic: enoughSplit && !p.likes_hidden ? median(organic.map((x) => x.er)) : null,
      posts: paid,
    },
    bets: { hits: bets, scannedPosts: view.content.all.length },
    posts: latest,
    growth: {
      firstSeenAt: first?.captured_at ?? null,
      delta: first?.followers != null && p.followers != null ? p.followers - first.followers : null,
      series: followersSeries,
      snapshots: snapshots.length,
    },
    price: { mediaValue, closed: await closedPrices(p.platform, tier, roster) },
  };
}

/** The handful of numbers the hunt list shows per row. */
export type ProspectRow = {
  id: string;
  platform: Platform;
  handle: string;
  name: string;
  avatarUrl: string | null;
  followers: number | null;
  er: number | null;
  views: number | null;
  postsPerWeek: number | null;
  status: HuntProfile["status"];
  bets: boolean;
  fetchedAt: string | null;
  href: string;
};

export function rowOf(p: HuntProfile, windowDays: number = HUNT_DEFAULT_WINDOW): ProspectRow {
  const view = analyze(p.platform, statsOf(p), null, windowDays);
  const isIg = p.platform === "instagram";
  const withViews = view?.content.all.filter((x) => x.views != null).length ?? 0;
  const bets = scanBets({
    bio: p.bio,
    link: p.link,
    profileUrl: null,
    posts: (view?.content.all ?? []).map((x) => ({ caption: x.caption, postedAt: x.postedAt, permalink: x.permalink })),
  });
  return {
    id: p.id,
    platform: p.platform,
    handle: p.handle,
    name: p.display_name?.trim() || `@${p.handle}`,
    avatarUrl: p.avatar_url,
    followers: p.followers,
    er: p.likes_hidden || !view?.window.posts ? null : view.engagement.rate,
    views: isIg && withViews < 3 ? null : view?.typical.views ?? null,
    postsPerWeek: view?.window.posts ? view.postsPerWeek : null,
    status: p.status,
    bets: bets.length > 0,
    fetchedAt: p.fetched_at,
    href: `/admin/hunt/${p.platform}/${encodeURIComponent(p.handle)}`,
  };
}
