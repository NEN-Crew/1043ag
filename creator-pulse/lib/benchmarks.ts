/**
 * Every judgement this dashboard makes traces back to a number in this file, so
 * there is exactly one place to argue with. Sources are listed in README.md.
 */

export type Tier = {
  name: string;
  min: number;
  /** Engagement rate (%) considered normal for an account this size. */
  band: [number, number];
};

// Engagement falls as audience grows, so "good" only means anything next to a
// size band. Bands are the 2026 consensus across public benchmark reports.
export const TIERS: Tier[] = [
  { name: "Nano", min: 0, band: [3, 5] },
  { name: "Micro", min: 10_000, band: [1.5, 3] },
  { name: "Mid", min: 100_000, band: [1, 2] },
  { name: "Macro", min: 500_000, band: [0.8, 1.5] },
  { name: "Mega", min: 1_000_000, band: [0.5, 1] },
];

export function tierFor(followers: number | null | undefined): Tier {
  const f = followers ?? 0;
  for (let i = TIERS.length - 1; i >= 0; i--) if (f >= TIERS[i].min) return TIERS[i];
  return TIERS[0];
}

/**
 * A metric becomes a 0–100 score by interpolating between anchors. The anchors
 * always mean the same thing, which is what makes the score explainable:
 *   50 = the bottom of normal, 80 = the top of normal, 100 = double the top.
 */
export type Anchor = { at: number; score: number };

export function scoreAt(value: number | null | undefined, anchors: Anchor[]): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const pts = [{ at: 0, score: 0 }, ...anchors];
  const last = pts[pts.length - 1];
  if (value >= last.at) return 100;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (value <= b.at) {
      const t = (value - a.at) / (b.at - a.at);
      return Math.round(a.score + t * (b.score - a.score));
    }
  }
  return 100;
}

/** Engagement is graded against the account's own size band. */
export function engagementAnchors(tier: Tier): Anchor[] {
  const [lo, hi] = tier.band;
  return [
    { at: lo, score: 50 },
    { at: hi, score: 80 },
    { at: hi * 2, score: 100 },
  ];
}

/**
 * Views ÷ followers. Two published numbers bracket this: 10% is the top of the
 * "excellent" range for view rate across all creators, and ~31% is the average
 * reach rate reported for Reels among active accounts. An agency roster is the
 * second population, so 10% is the floor of normal and 31% is the top of it.
 * Anchoring on the first alone puts every healthy account at 100.
 */
export const VIEW_RATE_ANCHORS: Anchor[] = [
  { at: 10, score: 50 },
  { at: 30, score: 80 },
  { at: 80, score: 100 },
];

/**
 * Share of interactions that took real effort (comments, saves, shares) rather
 * than a double-tap. A ratio, so it needs no absolute benchmark and behaves the
 * same on both platforms.
 */
export const EFFORT_SHARE_ANCHORS: Anchor[] = [
  { at: 8, score: 50 },
  { at: 20, score: 80 },
  { at: 40, score: 100 },
];

/**
 * TikTok's API gives us no saves, so its effort pool is comments + shares where
 * Instagram's is comments + saves + shares. Scoring both against the same
 * anchors would mark every TikTok account down for a metric the API withholds,
 * so the band is scaled to the signals we can actually see.
 */
export const EFFORT_SHARE_ANCHORS_TIKTOK: Anchor[] = [
  { at: 5, score: 50 },
  { at: 12, score: 80 },
  { at: 24, score: 100 },
];

/** Below this many recent posts there isn't enough to score honestly. */
export const MIN_POSTS_TO_SCORE = 3;

/** Posts per week. Operational, not from a benchmark report: campaigns need cadence. */
export const CADENCE_ANCHORS: Anchor[] = [
  { at: 1, score: 50 },
  { at: 3, score: 80 },
  { at: 5, score: 100 },
];

/** (saves + shares) ÷ reach. Shown next to posts, not scored. 1–2% is solid. */
export const SENDS_PER_REACH_BAND: [number, number] = [1, 2];

/**
 * Estimated media value. Brazilian market CPM is R$15–35 per 1,000 views.
 * Override with MEDIA_VALUE_* env vars if you bill in another currency.
 */
export const CPM = {
  currency: process.env.MEDIA_VALUE_CURRENCY ?? "R$",
  low: Number(process.env.MEDIA_VALUE_CPM_LOW ?? 15),
  high: Number(process.env.MEDIA_VALUE_CPM_HIGH ?? 35),
};

export type Grade = { label: string; tone: "great" | "good" | "ok" | "low" };

export function grade(score: number | null | undefined): Grade | null {
  if (score == null) return null;
  if (score >= 85) return { label: "Exceptional", tone: "great" };
  if (score >= 70) return { label: "Strong", tone: "great" };
  if (score >= 55) return { label: "Solid", tone: "good" };
  if (score >= 40) return { label: "Fair", tone: "ok" };
  return { label: "Needs work", tone: "low" };
}
