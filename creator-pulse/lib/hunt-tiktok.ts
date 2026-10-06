/**
 * TikTok prospects, read through ScrapeCreators, a third-party public-data
 * API. TikTok offers no official way to look up a creator who hasn't
 * authorised an app, so this is the only route, and it is kept strictly apart
 * from Pulse's own TikTok app: no creator token, no Login Kit, ever.
 *
 * Each request costs one prepaid credit (a lookup is 2–5), so the fetch is
 * careful about pagination and never retries a 4xx.
 */
import { POST_CAP } from "./metrics";
import { FetchedProfile, HuntError, MAX_AGE_DAYS, MAX_PAGES, exactInt, fetchWithRetry } from "./hunt-source";

const API = "https://api.scrapecreators.com";

export function tiktokConfigured(): boolean {
  return Boolean(process.env.SCRAPECREATORS_API_KEY);
}

async function sc(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetchWithRetry(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: { "x-api-key": process.env.SCRAPECREATORS_API_KEY! },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) throw new HuntError("not_found", body?.error ?? body?.message ?? "HTTP 404");
  if (res.status === 401 || res.status === 403) throw new HuntError("token_expired", body?.error ?? `HTTP ${res.status}`);
  if (res.status === 429) throw new HuntError("rate_limited", body?.error ?? "HTTP 429");
  if (!res.ok || body?.success === false) {
    throw new HuntError("source_error", body?.error ?? body?.message ?? `HTTP ${res.status}`);
  }
  return body;
}

/**
 * `statsV2` carries exact counts as strings; the older `stats` can be rounded
 * and overflows on very large accounts. Prefer V2 whenever it is there.
 */
function count(stats: any, statsV2: any, key: string): number | null {
  const v2 = statsV2?.[key];
  if (v2 != null && v2 !== "") return exactInt(v2);
  return exactInt(stats?.[key]);
}

/** Pick the first cover URL that exists. Static covers first: a dynamic cover is a webp animation. */
function coverOf(v: any): string | null {
  const video = v?.video ?? {};
  for (const k of ["cover", "origin_cover", "dynamic_cover"]) {
    const url = video?.[k]?.url_list?.[0];
    if (url) return url;
  }
  return null;
}

function normalizeVideo(handle: string, v: any) {
  const s = v.statistics ?? {};
  const id = String(v.aweme_id ?? v.id ?? "");
  // TikTok flags branded content two ways depending on the client; either counts.
  const branded = Number(v.commerce_info?.branded_content_type ?? 0) > 0;
  return {
    id,
    title: v.desc || null,
    shareUrl: v.share_url ?? (id ? `https://www.tiktok.com/@${handle}/video/${id}` : null),
    cover: coverOf(v),
    createTime: exactInt(v.create_time),
    views: exactInt(s.play_count),
    likes: exactInt(s.digg_count),
    comments: exactInt(s.comment_count),
    shares: exactInt(s.share_count),
    // Public saves. Kept out of the ER on purpose: analyze() ignores TikTok
    // saves, so a prospect and a roster creator run the exact same formula.
    collects: exactInt(s.collect_count),
    paidFlag: Boolean(v.is_ad || v.is_paid_partnership || branded),
  };
}

async function fetchVideos(handle: string, region: string): Promise<any[]> {
  const cutoff = Math.floor((Date.now() - MAX_AGE_DAYS * 864e5) / 1000);
  const out: any[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES && out.length < POST_CAP; page++) {
    const params: Record<string, string> = { handle, sort_by: "latest", region };
    if (cursor) params.max_cursor = cursor;
    const d = await sc("/v3/tiktok/profile/videos", params);
    const batch: any[] = d?.aweme_list ?? [];
    out.push(...batch);
    const oldest = batch[batch.length - 1]?.create_time;
    const more = d?.has_more === 1 || d?.has_more === true;
    if (!batch.length || !more || !d?.max_cursor || (oldest && oldest < cutoff)) break;
    cursor = String(d.max_cursor);
  }
  return out.filter((v) => !v.create_time || v.create_time >= cutoff).slice(0, POST_CAP);
}

/**
 * The videos endpoint takes a `region` that defaults to GB, and an account
 * can come back empty under the wrong one. Brazilian creators are the common
 * case here, so BR goes first, then the vendor's own suggestion of US. An
 * empty page costs a credit either way; three tries is the ceiling.
 */
const REGIONS = ["BR", "US", "GB"];

export async function fetchTiktokProspect(handle: string): Promise<FetchedProfile> {
  if (!tiktokConfigured()) throw new HuntError("config_missing", "SCRAPECREATORS_API_KEY");

  const d = await sc("/v1/tiktok/profile", { handle });
  const user = d?.user;
  if (!user || !user.uniqueId) throw new HuntError("not_found", "no user in response");
  if (user.privateAccount || user.secret) throw new HuntError("private", "privateAccount");

  const stats = d.stats ?? {};
  const statsV2 = d.statsV2 ?? null;
  const videoCount = count(stats, statsV2, "videoCount");
  const realHandle = String(user.uniqueId).toLowerCase();

  let raw: any[] = [];
  if ((videoCount ?? 0) > 0) {
    for (const region of REGIONS) {
      raw = await fetchVideos(realHandle, region);
      if (raw.length) break;
    }
    if (!raw.length) throw new HuntError("incomplete", `videoCount=${videoCount} but no videos returned`);
  }

  return {
    platformUserId: user.id ? String(user.id) : null,
    handle: realHandle,
    displayName: user.nickname ?? null,
    bio: user.signature ?? null,
    link: user.bioLink?.link ?? null,
    avatarUrl: user.avatarLarger ?? user.avatarMedium ?? null,
    verified: user.verified == null ? null : Boolean(user.verified),
    likesHidden: false,
    followers: count(stats, statsV2, "followerCount"),
    following: count(stats, statsV2, "followingCount"),
    mediaCount: videoCount,
    likesTotal: count(stats, statsV2, "heartCount") ?? count(stats, statsV2, "heart"),
    posts: raw.map((v) => normalizeVideo(realHandle, v)),
    source: "scrapecreators",
  };
}
