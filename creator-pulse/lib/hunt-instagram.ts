/**
 * Instagram prospects, read through Meta's Business Discovery API with the
 * agency's own professional account. This is the Graph API on
 * graph.facebook.com ("Instagram API with Facebook Login"), a different flavour
 * from the Instagram-Login one creators connect with in lib/instagram.ts, and
 * it deliberately uses a separate token so hunt can never touch a creator's.
 */
import { POST_CAP } from "./metrics";
import { FetchedProfile, HuntError, MAX_AGE_DAYS, MAX_PAGES, exactInt, fetchWithRetry } from "./hunt-source";

/** The current stable Graph API version. One constant, so a bump is one edit. */
export const GRAPH_VERSION = "v26.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function instagramConfigured(): boolean {
  return Boolean(process.env.IG_DISCOVERY_TOKEN && process.env.IG_DISCOVERY_ACCOUNT_ID);
}

/**
 * Profile fields. `id,username,biography,website,followers_count,media_count`
 * are documented as public. `name`, `profile_picture_url` and `follows_count`
 * are returned by Business Discovery in practice but aren't marked public in
 * the reference, so if Meta drops one the whole call fails with code 100
 * ("nonexisting field"). The fetch retries once without them.
 */
const PROFILE_FIELDS_PUBLIC = "id,username,biography,website,followers_count,media_count";
const PROFILE_FIELDS_EXTRA = "name,profile_picture_url,follows_count";
const MEDIA_FIELDS =
  "id,caption,like_count,comments_count,view_count,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url";

type GraphError = { message?: string; type?: string; code?: number; error_subcode?: number; error_user_msg?: string };

/**
 * Graph error → the hunt vocabulary. Code 110 is what business_discovery
 * returns both for a username that doesn't exist and for a personal account;
 * the API can't tell them apart, so neither can we, and the UI copy says so.
 */
function mapGraphError(e: GraphError): HuntError {
  const raw = `(#${e.code ?? "?"}${e.error_subcode ? `/${e.error_subcode}` : ""}) ${e.message ?? ""}`.trim();
  const code = e.code ?? 0;
  if (code === 190) return new HuntError("token_expired", raw);
  if ([4, 17, 32, 613, 80002].includes(code)) return new HuntError("rate_limited", raw);
  if (code === 110) return new HuntError("not_professional", raw);
  if (code === 24 || /not found|cannot find|does not exist/i.test(e.message ?? "")) return new HuntError("not_found", raw);
  if (code === 100 && /username/i.test(e.message ?? "")) return new HuntError("not_found", raw);
  return new HuntError("source_error", raw);
}

async function discovery(handle: string, inner: string): Promise<any> {
  const url =
    `${GRAPH}/${process.env.IG_DISCOVERY_ACCOUNT_ID}?` +
    new URLSearchParams({
      fields: `business_discovery.username(${handle}){${inner}}`,
      access_token: process.env.IG_DISCOVERY_TOKEN!,
    });
  const res = await fetchWithRetry(url);
  const body = await res.json().catch(() => ({}));
  if (body?.error) throw mapGraphError(body.error);
  if (!res.ok) throw new HuntError("source_error", `HTTP ${res.status}`);
  const bd = body?.business_discovery;
  if (!bd) throw new HuntError("not_found", "no business_discovery in response");
  return bd;
}

function normalizePost(m: any) {
  // Reels report view_count; photos and carousels don't have views in this API.
  const isReel = m.media_product_type === "REELS" || m.media_type === "VIDEO";
  return {
    id: String(m.id),
    caption: m.caption ?? null,
    permalink: m.permalink ?? null,
    thumbnail: m.thumbnail_url ?? m.media_url ?? null,
    type: m.media_type ?? null,
    timestamp: m.timestamp ?? null,
    // like_count is omitted entirely when the creator hides likes; keep the
    // absence as null so it is dropped, never counted as zero.
    likes: m.like_count == null ? null : exactInt(m.like_count),
    comments: exactInt(m.comments_count),
    views: isReel ? exactInt(m.view_count) : null,
    reach: null,
    saves: null,
    shares: null,
  };
}

export async function fetchInstagramProspect(handle: string): Promise<FetchedProfile> {
  if (!instagramConfigured()) throw new HuntError("config_missing", "IG_DISCOVERY_TOKEN / IG_DISCOVERY_ACCOUNT_ID");

  const mediaExpr = (after: string | null) => `media${after ? `.after(${after})` : ""}.limit(50){${MEDIA_FIELDS}}`;

  let profile: any;
  try {
    profile = await discovery(handle, `${PROFILE_FIELDS_PUBLIC},${PROFILE_FIELDS_EXTRA},${mediaExpr(null)}`);
  } catch (err) {
    // A field Meta stopped returning fails the whole call; fall back to the documented set.
    if (err instanceof HuntError && err.code === "source_error" && /\(#100\)/.test(err.raw ?? "")) {
      profile = await discovery(handle, `${PROFILE_FIELDS_PUBLIC},${mediaExpr(null)}`);
    } else throw err;
  }

  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
  const raw: any[] = [...(profile.media?.data ?? [])];
  let after: string | null = profile.media?.paging?.cursors?.after ?? null;

  // Same stopping rules as lib/instagram.ts: enough posts, old enough, or no cursor.
  for (let page = 1; page < MAX_PAGES && after && raw.length < POST_CAP; page++) {
    const oldest = raw[raw.length - 1]?.timestamp;
    if (oldest && new Date(oldest).getTime() < cutoff) break;
    const next = await discovery(handle, mediaExpr(after));
    const batch = next.media?.data ?? [];
    if (!batch.length) break;
    raw.push(...batch);
    after = next.media?.paging?.cursors?.after ?? null;
  }

  const posts = raw
    .filter((m) => !m.timestamp || new Date(m.timestamp).getTime() >= cutoff)
    .slice(0, POST_CAP)
    .map(normalizePost);

  // Hidden likes: the field is simply absent. If most posts lack it the ER
  // would be comments alone over followers, which misleads, so the profile is
  // marked and the UI shows a dash instead.
  const withLikes = posts.filter((p) => p.likes != null).length;
  const likesHidden = posts.length > 0 && withLikes < posts.length / 2;

  const mediaCount = exactInt(profile.media_count);
  if ((mediaCount ?? 0) > 0 && posts.length === 0) {
    throw new HuntError("incomplete", `media_count=${mediaCount} but no media returned`);
  }

  return {
    platformUserId: profile.id ? String(profile.id) : null,
    handle: String(profile.username ?? handle).toLowerCase(),
    displayName: profile.name ?? null,
    bio: profile.biography ?? null,
    link: profile.website ?? null,
    avatarUrl: profile.profile_picture_url ?? null,
    verified: null,
    likesHidden,
    followers: exactInt(profile.followers_count),
    following: exactInt(profile.follows_count),
    mediaCount,
    likesTotal: null,
    posts,
    source: "meta_business_discovery",
  };
}
