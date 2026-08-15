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

export function delta(value: number | null | undefined, unit: "pp" | "pct"): Delta | null {
  if (value == null || !Number.isFinite(value)) return null;
  return { value, dir: value >= 0 ? "up" : "down", unit };
}

/** A 0–100 score becomes one of the four Portuguese verdicts. */
export function verdictFor(score: number | null | undefined): Verdict | null {
  if (score == null) return null;
  if (score >= 85) return { label: "Excelente", tone: "good" };
  if (score >= 55) return { label: "Bom", tone: "good" };
  if (score >= 40) return { label: "Médio", tone: "warn" };
  return { label: "Ruim", tone: "warn" };
}

export type PostFormat = "reel" | "carousel" | "photo" | "video";

export type Post = {
  id: string;
  format: PostFormat;
  formatLabel: string;
  caption: string;
  /** Engagement rate for this post, as a percentage number. */
  er: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  views: number | null;
  reach: number | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  postedAt: string | null;
};

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
  trend?: number[];
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
    trend: number[];
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
  window: { days: number; posts: number } | null;

  content: { top: Post[]; worst: Post[] };
  /** Median of the recent posts. Medians, so one viral post doesn't set the bar. */
  typical: { views: number | null; reach: number | null; likes: number | null; comments: number | null };
  /** (saves + shares) ÷ reach. Instagram only — the distribution signal. */
  sendsPerReach: number | null;

  score: number | null;
  scoreVerdict: Verdict | null;
  components: Component[];

  mediaValue: { low: number; high: number; currency: string; cpm: [number, number] } | null;
  caveat: string | null;
};

const DASH = "—";
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

function toPosts(platform: Platform, stats: any): Internal[] {
  const raw = (platform === "instagram" ? stats?.posts : stats?.videos) ?? [];
  const isIg = platform === "instagram";

  return raw.map((p: any): Internal => {
    const likes = p.likes ?? null;
    const comments = p.comments ?? null;
    const saves = isIg ? p.saves ?? null : null;
    const shares = p.shares ?? null;
    const reach = isIg ? p.reach ?? null : null;
    const views = p.views ?? null;

    // Instagram's total_interactions already folds in saves and shares; fall
    // back to adding up the parts when it's missing.
    const interactions = isIg
      ? p.totalInteractions ?? sum([likes, comments, saves, shares])
      : sum([likes, comments, shares]);

    const fmt = isIg
      ? IG_FORMATS[p.type] ?? { key: "photo" as PostFormat, label: "Post" }
      : { key: "video" as PostFormat, label: "Vídeo" };

    return {
      id: String(p.id),
      format: fmt.key,
      formatLabel: fmt.label,
      caption: ((isIg ? p.caption : p.title) || "").replace(/\s+/g, " ").trim(),
      er: ratio(interactions, reach ?? views),
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

function cadenceOf(posts: Internal[]): { cadence: number | null; window: PlatformView["window"] } {
  const times = posts
    .map((p) => (p.postedAt ? new Date(p.postedAt).getTime() : null))
    .filter((t): t is number => t != null && Number.isFinite(t));
  if (times.length < 2) return { cadence: null, window: null };
  const days = Math.max(1, (Math.max(...times) - Math.min(...times)) / 86_400_000);
  return { cadence: (times.length / days) * 7, window: { days: Math.round(days), posts: times.length } };
}

const KIND_LABELS: Record<EngagementKind, string> = {
  likes: "Curtidas",
  comments: "Comentários",
  saves: "Salvos",
  shares: "Enviados",
};

export type HistoryInput = {
  /** Follower counts oldest→newest, for the summary sparkline. */
  followerTrend: number[];
  followerDelta: Delta | null;
  /** Engagement rate per snapshot, oldest→newest. */
  erTrend: number[];
  erDelta: Delta | null;
  growthPct: number | null;
};

export function analyze(
  platform: Platform,
  stats: any,
  history?: HistoryInput | null
): PlatformView | null {
  if (!stats) return null;

  const isIg = platform === "instagram";
  const followers: number | null = stats.followers ?? null;
  const tier = tierFor(followers);
  const posts = toPosts(platform, stats);
  const { cadence, window } = cadenceOf(posts);

  const typical = {
    views: median(posts.map((p) => p.views)),
    reach: median(posts.map((p) => p.reach)),
    likes: median(posts.map((p) => p.likes)),
    comments: median(posts.map((p) => p.comments)),
  };
  const typicalInteractions = median(posts.map((p) => p.interactions));

  const engagementRate = ratio(typicalInteractions, followers);
  const byReach = median(posts.map((p) => p.er));
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
      score: scoreAt(engagementRate, engagementAnchors(tier)),
      display: pct(engagementRate, 2),
      benchmark: `${tier.name}: ${tier.band[0]}–${tier.band[1]}%`,
      note: `Reações em um post típico sobre os ${int(followers)} seguidores. Avaliado contra o normal para uma conta ${tier.name.toLowerCase()}, porque o engajamento cai conforme a audiência cresce.`,
    },
    {
      key: "reach",
      label: "Alcance",
      weight: 0.25,
      score: scoreAt(viewRate, VIEW_RATE_ANCHORS),
      display: pct(viewRate),
      benchmark: "10% piso, 30% típico",
      note: `Um post típico é visto ${int(typical.views)} vezes. É a checagem do número de seguidores: uma audiência grande que não assiste vale menos que uma pequena que assiste.`,
    },
    {
      key: "impact",
      label: "Impacto",
      weight: 0.2,
      score: scoreAt(effortShare, isIg ? EFFORT_SHARE_ANCHORS : EFFORT_SHARE_ANCHORS_TIKTOK),
      display: pct(effortShare),
      benchmark: isIg ? "8% normal, 20%+ forte" : "5% normal, 12%+ forte",
      note: isIg
        ? "Fatia das reações que foram comentários, salvamentos ou envios em vez de curtidas. Um envio vale cerca de 3 a 5 curtidas para o algoritmo, então é isso que leva o post além da audiência atual."
        : "Fatia das reações que foram comentários ou compartilhamentos em vez de curtidas. Curtidas baratas inflam uma taxa; estas não.",
    },
    {
      key: "consistency",
      label: "Consistência",
      weight: 0.15,
      score: scoreAt(cadence, CADENCE_ANCHORS),
      display: cadence == null ? DASH : `${cadence.toFixed(1)}/sem`,
      benchmark: "3/sem forte",
      note: window
        ? `${window.posts} posts nos últimos ${window.days} dias. Cadência é o que torna a entrega previsível quando uma campanha é fechada.`
        : "Ainda não há posts datados suficientes para medir um ritmo.",
    },
  ];

  // Rating an account off one or two posts is a coin flip with a number on it.
  if (!enough) for (const c of components) c.score = null;

  const scored = components.filter((c) => c.score != null);
  const weight = scored.reduce((a, c) => a + c.weight, 0);
  const score = weight ? Math.round(scored.reduce((a, c) => a + c.score! * c.weight, 0) / weight) : null;

  const ranked = posts.filter((p) => p.er != null).sort((a, b) => b.er! - a.er!);

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
      ? `Alcance e salvamentos vieram para ${withReach} de ${posts.length} posts — o Instagram não reporta esses números para todo tipo de mídia.`
      : null
    : "A API do TikTok não retorna alcance nem dados demográficos da audiência, então eles não aparecem aqui.";

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
      verdictNote: "vs. contas do mesmo porte",
      commentsRate,
      likesPerComment,
      breakdown,
      byReach,
    },

    summary,
    postsPerWeek: cadence,
    window,

    content: { top: ranked.slice(0, 4), worst: ranked.slice(-3).reverse() },
    typical,
    sendsPerReach,

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
    .map((a) => ({ label: a.key.replace("-", "–"), pct: a.pct }));

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

/** Paid-partnership detection. One predicate, used by both the tile and the count. */
export const PUBLI_RE = /#(publi|publicidade|ad|ads|paid|parceria|publipost)\b/i;

export function isPaid(post: Post): boolean {
  return PUBLI_RE.test(post.caption ?? "");
}
