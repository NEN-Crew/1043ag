/**
 * Turns stored platform numbers into the view model the dashboard consumes.
 *
 * The editorial rule the screen is built on: **engagement rate governs**. It is
 * the biggest number, the first thing rendered, and what the roster ranks by.
 * Everything else — reach, cadence, the composite score — is supporting
 * evidence, and is sized and placed accordingly.
 *
 * Pure: same stats in, same view model out, so it runs server-side for both
 * the creator and the agency screens without another round trip.
 */
import {
  CADENCE_ANCHORS,
  CPM,
  EFFORT_SHARE_ANCHORS,
  EFFORT_SHARE_ANCHORS_TIKTOK,
  MIN_POSTS_TO_SCORE,
  TIKTOK_ER_ANCHORS,
  Tier,
  VIEW_RATE_ANCHORS,
  engagementAnchors,
  scoreAt,
  tierFor,
} from "./benchmarks";

export type Platform = "instagram" | "tiktok";
export type Direction = "up" | "down";

/** Cobalt reads "good", orange-red reads "attention". Nothing else. */
export type Verdict = { label: string; tone: "good" | "warn" | "none" };

export type Delta = { value: number; dir: Direction; unit: "pp" | "pct" };

/** A dated observation. Charts need the date to label a hovered point. */
export type TrendPoint = { at: string; value: number };

export function delta(value: number | null | undefined, unit: "pp" | "pct"): Delta | null {
  if (value == null || !Number.isFinite(value)) return null;
  return { value, dir: value >= 0 ? "up" : "down", unit };
}

/**
 * A 0–100 score becomes one of four verdicts.
 *
 * Descriptive, never a grade. A creator reads their own report, and "Ruim"
 * stamped on their work lands as a verdict on them rather than on a number
 * against a benchmark. "Abaixo da média" says the same thing and stays a
 * measurement.
 */
export function verdictFor(score: number | null | undefined): Verdict | null {
  if (score == null) return null;
  if (score >= 85) return { label: "Excelente", tone: "good" };
  if (score >= 55) return { label: "Bom", tone: "good" };
  if (score >= 40) return { label: "Na média", tone: "warn" };
  return { label: "Abaixo da média", tone: "warn" };
}

export type PostFormat = "reel" | "carousel" | "photo" | "video";

export type Post = {
  id: string;
  format: PostFormat;
  formatLabel: string;
  caption: string;
  /**
   * Interactions ÷ followers, the same formula as the headline rate. Followers
   * are constant across a creator's posts, so this orders posts identically to
   * their raw interaction counts — the badge can never contradict the likes and
   * comments printed beside it. Dividing by reach instead ranks a 116-like post
   * above a 230-like one, which reads as broken however defensible it is.
   */
  er: number | null;
  /** Interactions ÷ reach: how hard it landed with the people who saw it. */
  reachRate: number | null;
  /**
   * How many times the follower base this post was delivered to. 1 means it
   * reached about as many people as the account has followers; 46 is what a
   * video on the For You page did here. It's the plainest evidence that a post
   * escaped its own audience, which is what "viral" actually means.
   */
  reachMultiple: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  /** saves + shares, the two that carry a post beyond the existing audience. */
  sends: number | null;
  views: number | null;
  reach: number | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  postedAt: string | null;
  /**
   * How far this post sits from the account's own median. Carried on the post
   * rather than splitting the list into groups: one ordered list can't put the
   * same post in two places, and it stays sorted highest-to-lowest whatever the
   * labels say.
   */
  standout: Standout;
};

/** null = inside the account's normal range, and deliberately unlabelled. */
export type Standout = "viral" | "high" | "low" | null;

export type EngagementKind = "likes" | "comments" | "saves" | "shares";

export type BreakdownStat = { kind: EngagementKind; label: string; count: number };

export type SummaryMetric = {
  key: string;
  label: string;
  value: number | null;
  /** Rendered small beside the value, e.g. "/100" or "%". */
  unit: string | null;
  delta: Delta | null;
  verdict: Verdict | null;
  trend?: TrendPoint[];
  /** Shown in the score disclosure, not on the cell. */
  note?: string;
};

export type Component = {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  display: string;
  benchmark: string;
  note: string;
};

export type Audience = {
  geography: { name: string; pct: number }[];
  gender: { female: number; male: number } | null;
  age: { label: string; pct: number }[];
  summary: string | null;
};

export type PlatformView = {
  platform: Platform;
  label: string;
  handle: string | null;
  avatarUrl: string | null;
  updatedAt: string | null;
  tier: Tier;
  followers: number | null;

  engagement: {
    rate: number | null;
    /** vs. the snapshot ~30 days back. Null until the history exists. */
    delta: Delta | null;
    /** One point per day of history, oldest→newest. */
    trend: TrendPoint[];
    verdict: Verdict | null;
    verdictNote: string;
    commentsRate: number | null;
    likesPerComment: number | null;
    breakdown: BreakdownStat[];
    /** Interactions ÷ people reached — how the content did among those who saw it. */
    byReach: number | null;
  };

  summary: SummaryMetric[];
  postsPerWeek: number | null;
  /**
   * The period every aggregate on this view covers. It is a real date range,
   * not "the last N posts" — that reached back seven months for an account that
   * posts rarely, and reported it as "recent".
   */
  window: {
    days: number;
    posts: number;
    from: string;
    to: string;
    /** Newest post we hold, so an empty window can say when they last posted. */
    lastPostAt: string | null;
  };
  /** Lifetime likes across the whole account. TikTok reports it; Instagram doesn't. */
  lifetimeLikes: number | null;

  /**
   * Posts grouped by how far they sit from this account's own median, never by
   * rank. Ranking put the same post in both groups whenever the window held
   * fewer posts than the two slices asked for, and "top 4 of 4" was a claim
   * about nothing. `all` is every post in the window, ordered; `higher` and
   * `lower` are empty when the sample is too small to call anything an outlier.
   */
  content: {
    /** Every post in the window, always ordered by engagement, highest first. */
    all: Post[];
    paid: Post[];
    organic: Post[];
    /** How much the sample supports calling anything an outlier. */
    confidence: "none" | "weak" | "ok";
  };
  /** Median of the recent posts. Medians, so one viral post doesn't set the bar. */
  typical: { views: number | null; reach: number | null; likes: number | null; comments: number | null };
  /** (saves + shares) ÷ reach. Instagram only — the distribution signal. */
  sendsPerReach: number | null;
  /**
   * What was published on each day, so a point on the daily chart can show the
   * content behind it. The line itself is a rolling median across recent posts,
   * not one post — this says what landed that day, it doesn't relabel the point.
   */
  published: { at: string; thumbnailUrl: string | null; caption: string; formatLabel: string }[];

  score: number | null;
  scoreVerdict: Verdict | null;
  components: Component[];

  mediaValue: { low: number; high: number; currency: string; cpm: [number, number] } | null;
  caveat: string | null;
};

/**
 * Paid-partnership detection, from the caption. One predicate, used by the
 * tile, the counter and the paid-only section, so they can never disagree.
 *
 * The leading # is required — the bare word "ad" inside normal prose must not
 * match — and the trailing \b keeps #adidas and #advogado out.
 */
export const PUBLI_RE = /#(publi|publicidade|ad|ads|paid|parceria|publipost|recebido)\b/i;

export function isPaid(post: { caption: string }): boolean {
  return PUBLI_RE.test(post.caption ?? "");
}

const DASH = "-";
const pct = (n: number | null, d = 1) => (n == null ? DASH : `${n.toFixed(d)}%`);
const int = (n: number | null) => (n == null ? DASH : Math.round(n).toLocaleString("pt-BR"));

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

// Instagram reports video posts as VIDEO or REELS; both are Reels today.
const IG_FORMATS: Record<string, { key: PostFormat; label: string }> = {
  IMAGE: { key: "photo", label: "Foto" },
  CAROUSEL_ALBUM: { key: "carousel", label: "Carrossel" },
  VIDEO: { key: "reel", label: "Reel" },
  REELS: { key: "reel", label: "Reel" },
};

type Internal = Post & { interactions: number | null; sends: number | null };

function toPosts(platform: Platform, stats: any, followers: number | null): Internal[] {
  const raw = (platform === "instagram" ? stats?.posts : stats?.videos) ?? [];
  const isIg = platform === "instagram";

  return raw.map((p: any): Internal => {
    const likes = p.likes ?? null;
    const comments = p.comments ?? null;
    const saves = isIg ? p.saves ?? null : null;
    const shares = p.shares ?? null;
    const reach = isIg ? p.reach ?? null : null;
    const views = p.views ?? null;

    /**
     * Always the sum of the parts we can show, never Instagram's own
     * total_interactions. Two reasons: TikTok has no equivalent aggregate, so
     * using IG's would mean the two platforms ran different formulas; and IG's
     * total runs 3–13% above the itemised sum, which would leave a badge the
     * reader cannot reconcile with the counts printed beside it. A number you
     * can add up yourself is worth more than a marginally more official one.
     */
    const interactions = sum([likes, comments, saves, shares]);

    const fmt = isIg
      ? IG_FORMATS[p.type] ?? { key: "photo" as PostFormat, label: "Post" }
      : { key: "video" as PostFormat, label: "Vídeo" };

    return {
      id: String(p.id),
      format: fmt.key,
      formatLabel: fmt.label,
      caption: ((isIg ? p.caption : p.title) || "").replace(/\s+/g, " ").trim(),
      // Denominator per platform, chosen by how each one distributes.
      //
      // Instagram delivers mostly to followers, so followers is the right base
      // and the published tier bands apply. TikTok's For You page does not:
      // this account did 97.477 views on 2.110 followers, and dividing by
      // followers gave posts a "rate" of 676% and the account a bogus
      // "Excelente" against an Instagram-shaped band. Views are what TikTok
      // actually delivered, and every TikTok analytics tool uses them.
      er: isIg ? ratio(interactions, followers) : ratio(interactions, views),
      reachRate: ratio(interactions, reach ?? views),
      reachMultiple: followers && (views ?? reach) ? (views ?? reach)! / followers : null,
      standout: null,
      likes,
      comments,
      saves,
      shares,
      views,
      reach,
      thumbnailUrl: (isIg ? p.thumbnail : p.cover) ?? null,
      permalink: (isIg ? p.permalink : p.shareUrl) ?? null,
      postedAt:
        (isIg ? p.timestamp : p.createTime ? new Date(p.createTime * 1000).toISOString() : null) ?? null,
      interactions,
      sends: sum([saves, shares]),
    };
  });
}

/**
 * Cadence over the selected window, not over whatever span the posts happen to
 * cover. Posting 5 times in 90 days is 0,4/semana; measuring it across the gap
 * between the first and last of those posts would flatter it.
 */
function cadenceOver(posts: Internal[], windowDays: number): number | null {
  if (!posts.length) return 0;
  return (posts.length / windowDays) * 7;
}

const KIND_LABELS: Record<EngagementKind, string> = {
  likes: "Curtidas",
  comments: "Comentários",
  saves: "Salvos",
  shares: "Enviados",
};

export type HistoryInput = {
  /** Follower counts oldest→newest, one point per day. */
  followerTrend: TrendPoint[];
  followerDelta: Delta | null;
  /** Engagement rate per day, oldest→newest. */
  erTrend: TrendPoint[];
  erDelta: Delta | null;
  growthPct: number | null;
};

/**
 * Below this many posts, no post gets called an outlier. MAD and the median
 * both fluctuate badly on small samples, so "this one stood out" would be
 * noise wearing a label.
 */
const MIN_POSTS_TO_SPLIT = 6;

/**
 * Splits posts by distance from the account's own median, using the median
 * absolute deviation as the unit of spread. MAD is the robust choice here: it
 * has a 50% breakdown point, so a single viral post can't drag the threshold
 * up behind it the way a standard deviation would.
 *
 * The two cutoffs are deliberately asymmetric. One MAD above the median is
 * enough to be called out as strong; it takes two below to be called out as
 * weak. Being generous upward and strict downward is the right bias when a
 * creator reads their own report.
 */
function classify(posts: Internal[]): PlatformView["content"] {
  const rated = posts.filter((p) => p.er != null).sort((a, b) => b.er! - a.er!);
  const empty = { all: rated, paid: [] as Post[], organic: [] as Post[], confidence: "none" as const };

  // Two or three posts cannot establish a median to deviate from.
  if (rated.length < 4) {
    return { ...empty, paid: rated.filter(isPaid), organic: rated.filter((p) => !isPaid(p)) };
  }

  const ers = rated.map((p) => p.er!);
  const m = median(ers)!;

  /**
   * Spread is measured on each side of the median separately.
   *
   * Engagement rates are right-skewed and floored at zero: a couple of posts
   * that took off stretch the upper tail while the lower one stays compressed.
   * A single symmetric MAD absorbs that skew, and `median − 2·MAD` then lands
   * below zero — on this roster it did, so nothing could ever qualify as weak.
   */
  const sideSpread = (side: number[]) => {
    const d = median(side.map((e) => Math.abs(e - m)));
    return d && d > 0 ? d : m * 0.15;
  };
  const upper = sideSpread(ers.filter((e) => e > m));
  const lower = sideSpread(ers.filter((e) => e < m));

  // Under six posts the median and the spread both wobble, so the bar to be
  // called out doubles. Fewer labels, but the ones that appear are real.
  const weak = rated.length < MIN_POSTS_TO_SPLIT;
  const k = weak ? 2 : 1;

  for (const p of rated) {
    const e = p.er!;
    // Viral is a different claim from "above average": the post escaped the
    // account's own audience. Either an extreme deviation, or delivery several
    // times the follower base — the thing that actually happened.
    // Five times the follower base. Generous on purpose: the label is there to
    // credit a creator, so the bar starts where the post clearly went past its
    // own audience rather than where it becomes rare.
    const escaped = p.reachMultiple != null && p.reachMultiple >= 5;
    if (e >= m + 3 * upper || escaped) p.standout = "viral";
    else if (e >= m + k * upper) p.standout = "high";
    else if (e <= m - 2 * k * lower) p.standout = "low";
    else p.standout = null;
  }

  return {
    all: rated,
    paid: rated.filter(isPaid),
    organic: rated.filter((p) => !isPaid(p)),
    confidence: weak ? "weak" : "ok",
  };
}

/** The periods the UI offers. 30 days is the default and the industry norm. */
export const WINDOWS = [7, 30, 90, 365] as const;
export const DEFAULT_WINDOW = 30;

export function analyze(
  platform: Platform,
  stats: any,
  history?: HistoryInput | null,
  windowDays: number = DEFAULT_WINDOW
): PlatformView | null {
  if (!stats) return null;

  const isIg = platform === "instagram";
  const followers: number | null = stats.followers ?? null;
  const tier = tierFor(followers);

  const all = toPosts(platform, stats, followers);
  const from = new Date(Date.now() - windowDays * 864e5);
  const posts = all.filter((p) => p.postedAt && new Date(p.postedAt) >= from);

  const dates = all.map((p) => p.postedAt).filter(Boolean).sort() as string[];
  const window: PlatformView["window"] = {
    days: windowDays,
    posts: posts.length,
    from: from.toISOString(),
    to: new Date().toISOString(),
    lastPostAt: dates.length ? dates[dates.length - 1] : null,
  };
  const cadence = cadenceOver(posts, windowDays);

  const typical = {
    views: median(posts.map((p) => p.views)),
    reach: median(posts.map((p) => p.reach)),
    likes: median(posts.map((p) => p.likes)),
    comments: median(posts.map((p) => p.comments)),
  };
  const typicalInteractions = median(posts.map((p) => p.interactions));

  const engagementRate = isIg
    ? ratio(typicalInteractions, followers)
    : ratio(typicalInteractions, typical.views);
  const byReach = median(posts.map((p) => p.reachRate));
  const viewRate = ratio(typical.views, followers);
  const sendsPerReach = isIg ? median(posts.map((p) => ratio(p.sends, p.reach))) : null;
  const commentsRate = ratio(typical.comments, followers);
  const likesPerComment =
    typical.likes != null && typical.comments ? typical.likes / typical.comments : null;

  // Share of reactions that cost the viewer something: a comment, a save, a
  // send to a friend. Likes are free; these are what platforms rank on.
  const totalInteractions = sum(posts.map((p) => p.interactions));
  const totalEffort = sum(posts.flatMap((p) => [p.comments, p.saves, p.shares].filter((v) => v != null)));
  const effortShare = ratio(totalEffort, totalInteractions);

  const breakdown: BreakdownStat[] = (
    ["likes", "comments", "saves", "shares"] as EngagementKind[]
  )
    .map((kind) => ({ kind, label: KIND_LABELS[kind], count: sum(posts.map((p) => p[kind])) }))
    // TikTok has no saves; render N columns, never an empty cell.
    .filter((b): b is BreakdownStat => b.count != null);

  const enough = posts.length >= MIN_POSTS_TO_SCORE;

  const components: Component[] = [
    {
      key: "engagement",
      label: "Engajamento",
      weight: 0.4,
      score: scoreAt(engagementRate, isIg ? engagementAnchors(tier) : TIKTOK_ER_ANCHORS),
      display: pct(engagementRate, 2),
      benchmark: isIg ? `${tier.band[0]} a ${tier.band[1]}%` : "4 a 8% sobre as views",
      note: `Reações de um post típico sobre ${int(followers)} seguidores. Avaliado contra a faixa esperada para esse tamanho de perfil.`,
    },
    {
      key: "reach",
      label: "Alcance",
      weight: 0.25,
      score: scoreAt(viewRate, VIEW_RATE_ANCHORS),
      display: pct(viewRate),
      benchmark: "10% piso, 30% típico",
      note: `Um post típico é visto ${int(typical.views)} vezes, medido sobre o total de seguidores.`,
    },
    {
      key: "impact",
      label: "Impacto",
      weight: 0.2,
      score: scoreAt(effortShare, isIg ? EFFORT_SHARE_ANCHORS : EFFORT_SHARE_ANCHORS_TIKTOK),
      display: pct(effortShare),
      benchmark: isIg ? "8% normal, 20%+ forte" : "5% normal, 12%+ forte",
      note: isIg
        ? "Fatia das reações que foram comentários, salvamentos ou envios, em vez de curtidas."
        : "Fatia das reações que foram comentários ou compartilhamentos, em vez de curtidas.",
    },
    {
      key: "consistency",
      label: "Consistência",
      weight: 0.15,
      score: scoreAt(cadence, CADENCE_ANCHORS),
      display: cadence == null ? DASH : `${cadence.toFixed(1)}/sem`,
      benchmark: "3/sem forte",
      note: `${window.posts} posts em ${window.days} dias.`,
    },
  ];

  // Rating an account off one or two posts is a coin flip with a number on it.
  if (!enough) for (const c of components) c.score = null;

  const scored = components.filter((c) => c.score != null);
  const weight = scored.reduce((a, c) => a + c.weight, 0);
  const score = weight ? Math.round(scored.reduce((a, c) => a + c.score! * c.weight, 0) / weight) : null;

  const content = classify(posts);

  const summary: SummaryMetric[] = [
    {
      key: "followers",
      label: "Seguidores",
      value: followers,
      unit: null,
      delta: history?.followerDelta ?? null,
      verdict: null,
      trend: history?.followerTrend,
    },
    {
      key: "growth",
      label: "Crescimento",
      value: history?.growthPct ?? null,
      unit: "%",
      delta: null,
      verdict: null,
    },
    {
      key: "score",
      label: "Pulse score",
      value: score,
      unit: "/100",
      delta: null,
      verdict: verdictFor(score),
    },
    {
      key: "reach",
      label: isIg ? "Alcance médio" : "Views médias",
      value: isIg ? typical.reach ?? typical.views : typical.views,
      unit: null,
      delta: null,
      verdict: verdictFor(scoreAt(viewRate, VIEW_RATE_ANCHORS)),
    },
  ];

  const withReach = posts.filter((p) => p.reach != null).length;
  const caveat = isIg
    ? posts.length > 0 && withReach < posts.length
      ? `Alcance e salvamentos disponíveis em ${withReach} de ${posts.length} posts. O Instagram não reporta esses dados para todo tipo de mídia.`
      : null
    : "A API do TikTok não retorna alcance nem dados demográficos.";

  return {
    platform,
    label: isIg ? "Instagram" : "TikTok",
    handle: stats.username ?? null,
    avatarUrl: stats.avatar_url ?? null,
    updatedAt: stats.updated_at ?? null,
    tier,
    followers,

    engagement: {
      rate: engagementRate,
      delta: history?.erDelta ?? null,
      trend: history?.erTrend ?? [],
      verdict: verdictFor(components[0].score),
      // Says what the chip is measured against, so the reader can check it
      // instead of wondering where the word came from.
      // The tier name ("Nano") reads as a label on the person. The band says the
      // same thing without ranking them.
      verdictNote: isIg
        ? `${tier.band[0]} a ${tier.band[1]}% é o esperado para esse tamanho de perfil`
        : "4 a 8% sobre as views é o esperado no TikTok",
      commentsRate,
      likesPerComment,
      breakdown,
      byReach,
    },

    summary,
    postsPerWeek: cadence,
    window,

    content,
    typical,
    sendsPerReach,
    // bigint arrives as a string from Postgres.
    lifetimeLikes: stats.likes_total != null ? Number(stats.likes_total) : null,
    published: posts
      .filter((p) => p.postedAt)
      .map((p) => ({
        at: p.postedAt!,
        thumbnailUrl: p.thumbnailUrl,
        caption: p.caption,
        formatLabel: p.formatLabel,
      })),

    score,
    scoreVerdict: verdictFor(score),
    components,

    mediaValue:
      typical.views != null
        ? {
            low: (typical.views / 1000) * CPM.low,
            high: (typical.views / 1000) * CPM.high,
            currency: CPM.currency,
            cpm: [CPM.low, CPM.high] as [number, number],
          }
        : null,
    caveat,
  };
}

const GENDER_KEYS: Record<string, "female" | "male"> = { F: "female", M: "male" };

const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil",
  PT: "Portugal",
  US: "Estados Unidos",
  AR: "Argentina",
  ES: "Espanha",
  FR: "França",
  DE: "Alemanha",
  IT: "Itália",
  GB: "Reino Unido",
  JP: "Japão",
  MX: "México",
  CL: "Chile",
  CO: "Colômbia",
  UY: "Uruguai",
  PY: "Paraguai",
  CA: "Canadá",
  AU: "Austrália",
  NL: "Países Baixos",
  CH: "Suíça",
  AO: "Angola",
  MZ: "Moçambique",
};

/**
 * Instagram returns follower demographics as raw counts per breakdown.
 * Percentages are what a brief is actually written against.
 */
export function audienceFrom(demographics: any): Audience | null {
  if (!demographics) return null;

  const share = (rows: any[] | undefined) => {
    if (!rows?.length) return [];
    const total = rows.reduce((a, r) => a + (r.value ?? 0), 0);
    if (!total) return [];
    return rows.map((r) => ({ key: String(r.key), pct: ((r.value ?? 0) / total) * 100 }));
  };

  // Age brackets are ordinal — they keep their natural order, because a bar
  // chart of ages sorted by size is unreadable.
  const age = share(demographics.age)
    .sort((a, b) => a.key.localeCompare(b.key, "pt-BR", { numeric: true }))
    .map((a) => ({ label: a.key.replace("-", " a "), pct: a.pct }));

  const geography = share(demographics.country)
    .sort((a, b) => b.pct - a.pct)
    .map((c) => ({ name: COUNTRY_NAMES[c.key] ?? c.key, pct: c.pct }));

  const genderRows = share(demographics.gender);
  const known = genderRows.filter((g) => GENDER_KEYS[g.key]);
  const knownTotal = known.reduce((a, g) => a + g.pct, 0);
  // Instagram reports an "U" bucket; rebase F/M over the known share so the
  // pair reads as a split rather than mysteriously summing to 77%.
  const gender = knownTotal
    ? {
        female: ((known.find((g) => g.key === "F")?.pct ?? 0) / knownTotal) * 100,
        male: ((known.find((g) => g.key === "M")?.pct ?? 0) / knownTotal) * 100,
      }
    : null;

  if (!age.length && !geography.length && !gender) return null;

  const topAge = age.length ? age.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;
  const parts: string[] = [];
  if (gender) {
    const dominant = gender.female >= gender.male ? "mulheres" : "homens";
    parts.push(`${Math.round(Math.max(gender.female, gender.male))}% ${dominant}`);
  }
  if (topAge) parts.push(`na maioria ${topAge.label}`);
  if (geography[0]) parts.push(`${Math.round(geography[0].pct)}% no ${geography[0].name}`);

  return { geography, gender, age, summary: parts.length ? parts.join(", ") : null };
}

/** One number per creator for the roster, weighted by where the audience is. */
export function overallScore(views: (PlatformView | null)[]): number | null {
  const xs = views.filter((v): v is PlatformView => v?.score != null);
  if (!xs.length) return null;
  const weight = xs.reduce((a, x) => a + Math.max(1, x.followers ?? 1), 0);
  return Math.round(xs.reduce((a, x) => a + x.score! * Math.max(1, x.followers ?? 1), 0) / weight);
}


/** Reads the window off a URL param, refusing anything not on the menu. */
export function parseWindow(raw: string | undefined): number {
  const n = Number(raw);
  return (WINDOWS as readonly number[]).includes(n) ? n : DEFAULT_WINDOW;
}
