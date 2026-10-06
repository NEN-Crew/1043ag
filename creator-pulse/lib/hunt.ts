/**
 * The hunt data layer: external creators the agency looked up, kept apart
 * from the roster in their own tables and never joined to it.
 *
 * Two rules the rest of the app relies on:
 * - nothing here is reachable without a staff session (the routes and pages
 *   check `isAdmin()` before calling in);
 * - a fetch only happens on demand. The daily cron deletes old prospects and
 *   touches nothing else.
 */
import crypto from "node:crypto";
import { sql } from "./db";
import type { Platform } from "./metrics";
import { FetchedProfile, HuntError, asHuntError } from "./hunt-source";
import { fetchInstagramProspect, instagramConfigured } from "./hunt-instagram";
import { fetchTiktokProspect, tiktokConfigured } from "./hunt-tiktok";

/**
 * Freshness, in one place. A copy older than STALE_MS is re-fetched when
 * someone opens it; staff may force an update once it is COOLDOWN_MS old, the
 * same idea as the creator refresh button in app/api/refresh/[id]/route.ts.
 */
export const STALE_MS = 7 * 24 * 60 * 60 * 1000;
export const COOLDOWN_MS = 12 * 60 * 60 * 1000;
/** A fetch that has held the lock this long is presumed dead and may be retaken. */
const LOCK_MS = 2 * 60 * 1000;

export { HUNT_STATUSES, STATUS_LABEL, DELETE_REASONS } from "./hunt-status";
export type { HuntStatus, DeleteReason } from "./hunt-status";
import type { HuntStatus, DeleteReason } from "./hunt-status";

export type HuntProfile = {
  id: string;
  platform: Platform;
  handle: string;
  platform_user_id: string | null;
  display_name: string | null;
  bio: string | null;
  link: string | null;
  avatar_url: string | null;
  verified: boolean | null;
  likes_hidden: boolean;
  followers: number | null;
  following: number | null;
  media_count: number | null;
  likes_total: number | null;
  posts: any[];
  source: string | null;
  fetched_at: string | null;
  fetched_by: string | null;
  fetching_since: string | null;
  last_error: string | null;
  last_error_at: string | null;
  status: HuntStatus;
  notes: string | null;
  contact: string | null;
  influencer_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type HuntSnapshot = {
  captured_at: string;
  followers: number | null;
  following: number | null;
  media_count: number | null;
  likes_total: number | null;
};

const iso = (v: any) => (v == null ? null : new Date(v).toISOString());
// bigint comes back as a string from Postgres.
const num = (v: any) => (v == null ? null : Number(v));

function fromRow(r: any): HuntProfile {
  return {
    ...r,
    followers: num(r.followers),
    following: num(r.following),
    media_count: num(r.media_count),
    likes_total: num(r.likes_total),
    posts: Array.isArray(r.posts) ? r.posts : [],
    fetched_at: iso(r.fetched_at),
    fetching_since: iso(r.fetching_since),
    last_error_at: iso(r.last_error_at),
    created_at: iso(r.created_at)!,
    updated_at: iso(r.updated_at)!,
  };
}

export function isStale(p: { fetched_at: string | null }): boolean {
  return !p.fetched_at || Date.now() - new Date(p.fetched_at).getTime() > STALE_MS;
}

/** Milliseconds until a manual update is allowed again; 0 when it is. */
export function cooldownLeft(p: { fetched_at: string | null }): number {
  if (!p.fetched_at) return 0;
  return Math.max(0, new Date(p.fetched_at).getTime() + COOLDOWN_MS - Date.now());
}

export function profileHref(p: { platform: Platform; handle: string }): string {
  return `/admin/hunt/${p.platform}/${encodeURIComponent(p.handle)}`;
}

export function configured(platform: Platform): boolean {
  return platform === "instagram" ? instagramConfigured() : tiktokConfigured();
}

export function hashHandle(platform: Platform, handle: string): string {
  return crypto.createHash("sha256").update(`${platform}:${handle}`).digest("hex");
}

/* ------------------------------------------------------------------ reads -- */

export async function getProfile(id: string): Promise<HuntProfile | null> {
  const r = (await sql`select * from hunt_profiles where id = ${id}`)[0];
  return r ? fromRow(r) : null;
}

export async function getProfileByHandle(platform: Platform, handle: string): Promise<HuntProfile | null> {
  const r = (await sql`select * from hunt_profiles where platform = ${platform} and handle = ${handle}`)[0];
  return r ? fromRow(r) : null;
}

/** Every prospect, newest data first. */
export async function listProfiles(): Promise<HuntProfile[]> {
  const rows = await sql`
    select * from hunt_profiles order by coalesce(fetched_at, created_at) desc, created_at desc`;
  return (rows as any[]).map(fromRow);
}

export async function listSnapshots(profileId: string): Promise<HuntSnapshot[]> {
  const rows = await sql`
    select captured_at, followers, following, media_count, likes_total
    from hunt_snapshots where profile_id = ${profileId} order by captured_at asc`;
  return (rows as any[]).map((r) => ({
    captured_at: iso(r.captured_at)!,
    followers: num(r.followers),
    following: num(r.following),
    media_count: num(r.media_count),
    likes_total: num(r.likes_total),
  }));
}

export async function isSuppressed(platform: Platform, handle: string): Promise<boolean> {
  const r = (await sql`
    select 1 from hunt_suppressed where platform = ${platform} and handle_hash = ${hashHandle(platform, handle)}`)[0];
  return Boolean(r);
}

/**
 * Is this handle already a creator of 1043? Checked before any fetch: paying
 * a vendor for public numbers on someone whose official numbers are one
 * click away would be silly, and the roster page is the better page anyway.
 */
export async function rosterMatch(platform: Platform, handle: string): Promise<{ id: string } | null> {
  const rows =
    platform === "instagram"
      ? await sql`select influencer_id as id from instagram_stats where lower(username) = ${handle} limit 1`
      : await sql`select influencer_id as id from tiktok_stats where lower(username) = ${handle} limit 1`;
  return rows[0] ? { id: String(rows[0].id) } : null;
}

/* ----------------------------------------------------------------- writes -- */

function newId(): string {
  return `hunt-${crypto.randomBytes(5).toString("hex")}`;
}

/**
 * Takes the fetch lock. One row back means we own it; none means another
 * fetch is running (or the lock is younger than LOCK_MS) and the caller
 * should serve the current copy instead.
 */
async function claimLock(id: string): Promise<boolean> {
  const rows = await sql`
    update hunt_profiles set fetching_since = now()
    where id = ${id}
      and (fetching_since is null or fetching_since < now() - (${LOCK_MS} || ' milliseconds')::interval)
    returning id`;
  return rows.length > 0;
}

/** Slim per-post numbers for the snapshot: no captions, no URLs. */
function slimMetrics(platform: Platform, posts: any[]) {
  return posts.map((p) =>
    platform === "instagram"
      ? { id: p.id, date: p.timestamp, likes: p.likes, comments: p.comments, views: p.views, shares: null }
      : {
          id: p.id,
          date: p.createTime ? new Date(p.createTime * 1000).toISOString() : null,
          likes: p.likes,
          comments: p.comments,
          views: p.views,
          shares: p.shares,
        }
  );
}

async function storeSuccess(id: string, platform: Platform, f: FetchedProfile, by: string | null) {
  await sql`
    update hunt_profiles set
      platform_user_id = ${f.platformUserId}, display_name = ${f.displayName}, bio = ${f.bio}, link = ${f.link},
      avatar_url = ${f.avatarUrl}, verified = ${f.verified}, likes_hidden = ${f.likesHidden},
      followers = ${f.followers}, following = ${f.following}, media_count = ${f.mediaCount}, likes_total = ${f.likesTotal},
      posts = ${JSON.stringify(f.posts)}::jsonb, source = ${f.source},
      fetched_at = now(), fetched_by = ${by}, fetching_since = null,
      last_error = null, last_error_at = null, updated_at = now()
    where id = ${id}`;
  await sql`
    insert into hunt_snapshots (profile_id, source, fetched_by, followers, following, media_count, likes_total, post_metrics)
    values (${id}, ${f.source}, ${by}, ${f.followers}, ${f.following}, ${f.mediaCount}, ${f.likesTotal},
            ${JSON.stringify(slimMetrics(platform, f.posts))}::jsonb)`;
}

async function storeFailure(id: string, err: HuntError) {
  await sql`
    update hunt_profiles set last_error = ${`${err.code}: ${err.raw ?? ""}`.slice(0, 500)}, last_error_at = now(),
                             fetching_since = null
    where id = ${id}`;
}

async function fetchFor(platform: Platform, handle: string): Promise<FetchedProfile> {
  return platform === "instagram" ? fetchInstagramProspect(handle) : fetchTiktokProspect(handle);
}

export type LookupResult =
  | { status: "ok"; href: string; cached: boolean }
  | { status: "roster"; href: string }
  | { status: "error"; code: HuntError["code"] };

/**
 * The search box. Serves a saved copy when there is one, fresh or stale (the
 * prospect page revalidates). Otherwise fetches once, behind a lock, and only
 * keeps a row when the account was actually found.
 */
export async function lookup(platform: Platform, handle: string, by: string | null): Promise<LookupResult> {
  const roster = await rosterMatch(platform, handle);
  if (roster) return { status: "roster", href: `/admin/${roster.id}?rede=${platform}` };
  if (await isSuppressed(platform, handle)) return { status: "error", code: "suppressed" };

  const existing = await getProfileByHandle(platform, handle);
  if (existing?.fetched_at) return { status: "ok", href: profileHref(existing), cached: true };
  if (!configured(platform)) return { status: "error", code: "config_missing" };

  // A placeholder row is the lock for a brand-new handle: two staff searching
  // the same person at once produce one insert, so one fetch. The row is
  // removed again if the account turns out not to exist.
  const id = newId();
  const inserted = await sql`
    insert into hunt_profiles (id, platform, handle, fetching_since, created_by)
    values (${id}, ${platform}, ${handle}, now(), ${by})
    on conflict (platform, handle) do nothing
    returning id`;

  if (!inserted.length) {
    // Someone else is fetching it right now. Wait for their result.
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const p = await getProfileByHandle(platform, handle);
      if (!p) return { status: "error", code: "not_found" };
      if (p.fetched_at) return { status: "ok", href: profileHref(p), cached: true };
      if (p.last_error) return { status: "error", code: (p.last_error.split(":")[0] as HuntError["code"]) || "source_error" };
    }
    return { status: "error", code: "source_error" };
  }

  try {
    const f = await fetchFor(platform, handle);
    await storeSuccess(id, platform, f, by);
    // The source may spell the handle differently from what was typed (e.g.
    // a redirect to the canonical username); keep the typed one as the key.
    return { status: "ok", href: profileHref({ platform, handle }), cached: false };
  } catch (e) {
    const err = asHuntError(e);
    // Nothing to keep: no row for accounts that aren't there or can't be read.
    await sql`delete from hunt_profiles where id = ${id}`;
    return { status: "error", code: err.code };
  }
}

export type RefreshResult =
  | { status: "ok" }
  | { status: "fresh" }
  | { status: "busy" }
  | { status: "cooldown"; retryInMs: number }
  | { status: "error"; code: HuntError["code"] };

/**
 * Re-fetch a saved prospect. `auto` is the page revalidating a stale copy and
 * is a no-op on a fresh one; a manual call respects the 12 h cooldown. Both
 * go through the lock, and a failure leaves the saved copy untouched.
 */
export async function refreshProfile(id: string, opts: { auto: boolean; by: string | null }): Promise<RefreshResult | null> {
  const p = await getProfile(id);
  if (!p) return null;
  if (opts.auto && !isStale(p)) return { status: "fresh" };
  if (!opts.auto) {
    const left = cooldownLeft(p);
    if (left > 0) return { status: "cooldown", retryInMs: left };
  }
  if (!configured(p.platform)) return { status: "error", code: "config_missing" };
  if (!(await claimLock(id))) return { status: "busy" };

  try {
    const f = await fetchFor(p.platform, p.handle);
    await storeSuccess(id, p.platform, f, opts.by);
    return { status: "ok" };
  } catch (e) {
    const err = asHuntError(e);
    await storeFailure(id, err);
    return { status: "error", code: err.code };
  }
}

export type HuntPatch = { status?: HuntStatus; notes?: string | null; contact?: string | null; influencerId?: string | null };

export async function patchProfile(id: string, patch: HuntPatch): Promise<HuntProfile | null> {
  const p = await getProfile(id);
  if (!p) return null;
  const status = patch.status ?? p.status;
  const notes = patch.notes === undefined ? p.notes : patch.notes;
  const contact = patch.contact === undefined ? p.contact : patch.contact;
  const influencerId = patch.influencerId === undefined ? p.influencer_id : patch.influencerId;
  const r = (await sql`
    update hunt_profiles set status = ${status}, notes = ${notes}, contact = ${contact},
                             influencer_id = ${influencerId}, updated_at = now()
    where id = ${id} returning *`)[0];
  return r ? fromRow(r) : null;
}

/**
 * Deletes a prospect and its snapshots. "The profile asked" and "minor" also
 * suppress the handle, hashed, so it can never be fetched again, and so the
 * suppression table itself holds no handle in clear.
 */
export async function deleteProfile(id: string, reason: DeleteReason): Promise<boolean> {
  const p = await getProfile(id);
  if (!p) return false;
  if (reason === "pedido_do_perfil" || reason === "menor_de_idade") {
    await sql`
      insert into hunt_suppressed (platform, handle_hash, reason)
      values (${p.platform}, ${hashHandle(p.platform, p.handle)}, ${reason})
      on conflict do nothing`;
  }
  await sql`delete from hunt_profiles where id = ${id}`;
  return true;
}

/**
 * Retention: prospects that didn't close and haven't been fetched or edited
 * in 12 months go. Called once a day from the cron route; one statement.
 */
export async function purgeStaleProspects(): Promise<number> {
  const rows = await sql`
    delete from hunt_profiles
    where status <> 'fechado'
      and greatest(coalesce(fetched_at, created_at), updated_at) < now() - interval '12 months'
    returning id`;
  return rows.length;
}
