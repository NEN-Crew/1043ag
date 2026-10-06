/**
 * What the two hunt fetchers share: the error vocabulary the API speaks, and
 * one HTTP helper with the timeout and retry the brief asks for.
 */

export type HuntErrorCode =
  | "invalid_handle"
  | "not_found"
  | "not_professional"
  | "private"
  | "suppressed"
  | "config_missing"
  | "token_expired"
  | "rate_limited"
  | "source_error"
  | "incomplete";

export class HuntError extends Error {
  code: HuntErrorCode;
  /** The upstream message, kept in last_error so a failure can be diagnosed later. */
  raw: string | null;
  constructor(code: HuntErrorCode, raw?: string | null) {
    super(raw ?? code);
    this.code = code;
    this.raw = raw ?? null;
  }
}

export function asHuntError(err: unknown): HuntError {
  if (err instanceof HuntError) return err;
  return new HuntError("source_error", err instanceof Error ? err.message : String(err));
}

export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * fetch with a 15 s budget and one retry on a 5xx or a network failure. A 4xx
 * is a real answer (not found, bad token) and comes back as-is for the caller
 * to interpret; retrying it would only spend another credit.
 */
export async function fetchWithRetry(url: string, init: RequestInit = {}): Promise<Response> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
      if (res.status >= 500 && attempt === 0) {
        last = new Error(`HTTP ${res.status}`);
        continue;
      }
      return res;
    } catch (err) {
      last = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new HuntError("source_error", last instanceof Error ? last.message : String(last));
}

/** Caps shared with lib/instagram.ts and lib/tiktok.ts, so a prospect never holds more history than a creator. */
export const MAX_AGE_DAYS = 400;
export const MAX_PAGES = 4;

/** The profile and the posts a fetch yields, platform-neutral where it can be. */
export type FetchedProfile = {
  platformUserId: string | null;
  handle: string;
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
  /** Items in the instagram_stats.posts or tiktok_stats.videos shape. */
  posts: any[];
  source: "meta_business_discovery" | "scrapecreators";
};

/** Exact integers only. Pulse never stores "1.2M". */
export function exactInt(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}
