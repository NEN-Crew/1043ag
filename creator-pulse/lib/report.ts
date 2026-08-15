import { sql } from "./db";
import { decrypt, encrypt } from "./crypto";
import { HistoryByPlatform, emptyHistory, getHistory } from "./history";
import {
  Audience,
  Delta,
  PlatformView,
  Verdict,
  analyze,
  audienceFrom,
  delta,
  overallScore,
  verdictFor,
} from "./metrics";
import * as ig from "./instagram";
import * as tt from "./tiktok";

export type CreatorReport = {
  influencer: { id: string; name: string; email: string };
  connected: { instagram: boolean; tiktok: boolean };
  /** Only the platforms this creator actually has — drives which tabs render. */
  platforms: PlatformView[];
  /** Fallback photo for a network that has none. Instagram first. */
  avatarUrl: string | null;
  audience: Audience | null;
  /** Follower-weighted score across the connected platforms. */
  overall: number | null;
  totalFollowers: number | null;
};

/** One row of the agency ranking. Engagement rate is the ranking key. */
export type RosterEntry = {
  creatorId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  platform: "instagram" | "tiktok";
  platformLabel: string;
  er: number | null;
  erDelta: Delta | null;
  followers: number | null;
  growth: number | null;
  growthDelta: Delta | null;
  verdict: Verdict | null;
  updatedAt: string | null;
};

export type AgencyRoster = {
  meta: { creatorCount: number; connectedCount: number; avgEr: number | null; totalReach: number | null };
  creators: RosterEntry[];
  /** Creators with nothing connected yet — listed separately, never ranked. */
  pending: { id: string; name: string; email: string }[];
};

function assemble(
  inf: { id: string; name: string; email: string },
  connected: Set<string>,
  igStats: any | null,
  ttStats: any | null,
  history: HistoryByPlatform
): CreatorReport {
  const views = [
    connected.has("instagram") ? analyze("instagram", igStats, history.instagram) : null,
    connected.has("tiktok") ? analyze("tiktok", ttStats, history.tiktok) : null,
  ].filter((v): v is PlatformView => v != null);

  const followers = views.map((v) => v.followers).filter((f): f is number => f != null);
  const avatarUrl =
    views.find((v) => v.platform === "instagram" && v.avatarUrl)?.avatarUrl ??
    views.find((v) => v.avatarUrl)?.avatarUrl ??
    null;

  return {
    influencer: inf,
    connected: { instagram: connected.has("instagram"), tiktok: connected.has("tiktok") },
    platforms: views,
    avatarUrl,
    audience: audienceFrom(igStats?.demographics),
    overall: overallScore(views),
    totalFollowers: followers.length ? followers.reduce((a, b) => a + b, 0) : null,
  };
}

export async function getReport(influencerId: string): Promise<CreatorReport | null> {
  const inf = (await sql`select id, name, email from influencers where id = ${influencerId}`)[0];
  if (!inf) return null;

  const [conns, igRows, ttRows, history] = await Promise.all([
    sql`select platform from connections where influencer_id = ${influencerId}`,
    sql`select * from instagram_stats where influencer_id = ${influencerId}`,
    sql`select * from tiktok_stats where influencer_id = ${influencerId}`,
    getHistory([influencerId]),
  ]);

  return assemble(
    { id: inf.id, name: inf.name, email: inf.email },
    new Set((conns as any[]).map((c) => c.platform)),
    igRows[0] ?? null,
    ttRows[0] ?? null,
    history.get(influencerId) ?? emptyHistory
  );
}

/**
 * The whole roster, analysed, in a fixed number of queries.
 *
 * A creator active on both platforms produces one ranking row per platform:
 * comparing an Instagram ER against a TikTok ER is meaningless, so the row is
 * the unit of comparison, not the person, and the network filter is what makes
 * the ranking like-for-like.
 */
export async function getRoster(): Promise<AgencyRoster> {
  const influencers = (await sql`
    select id, name, email from influencers order by created_at desc
  `) as any[];

  if (!influencers.length) {
    return { meta: { creatorCount: 0, connectedCount: 0, avgEr: null, totalReach: null }, creators: [], pending: [] };
  }

  const ids = influencers.map((i) => i.id);
  const [conns, igRows, ttRows, history] = await Promise.all([
    sql`select influencer_id, platform from connections where influencer_id = any(${ids}::text[])`,
    sql`select * from instagram_stats where influencer_id = any(${ids}::text[])`,
    sql`select * from tiktok_stats where influencer_id = any(${ids}::text[])`,
    getHistory(ids),
  ]);

  const connBy = new Map<string, Set<string>>();
  for (const c of conns as any[]) {
    const set = connBy.get(c.influencer_id) ?? new Set<string>();
    set.add(c.platform);
    connBy.set(c.influencer_id, set);
  }
  const igBy = new Map((igRows as any[]).map((r) => [r.influencer_id, r]));
  const ttBy = new Map((ttRows as any[]).map((r) => [r.influencer_id, r]));

  const creators: RosterEntry[] = [];
  const pending: AgencyRoster["pending"] = [];

  for (const inf of influencers) {
    const connected = connBy.get(inf.id) ?? new Set<string>();
    if (!connected.size) {
      pending.push({ id: inf.id, name: inf.name, email: inf.email });
      continue;
    }
    const hist = history.get(inf.id) ?? emptyHistory;
    const report = assemble(
      { id: inf.id, name: inf.name, email: inf.email },
      connected,
      igBy.get(inf.id) ?? null,
      ttBy.get(inf.id) ?? null,
      hist
    );

    for (const v of report.platforms) {
      const h = v.platform === "instagram" ? hist.instagram : hist.tiktok;
      creators.push({
        creatorId: inf.id,
        name: inf.name,
        handle: v.handle,
        // A row is an account, so it wears that account's photo.
        avatarUrl: v.avatarUrl ?? report.avatarUrl,
        platform: v.platform,
        platformLabel: v.label,
        er: v.engagement.rate,
        erDelta: h.erDelta,
        followers: v.followers,
        growth: h.growthPct,
        growthDelta: delta(h.growthPct, "pct"),
        verdict: v.engagement.verdict ?? verdictFor(v.score),
        updatedAt: v.updatedAt,
      });
    }
  }

  const ers = creators.map((c) => c.er).filter((e): e is number => e != null);
  const reach = creators.map((c) => c.followers).filter((f): f is number => f != null);

  return {
    meta: {
      creatorCount: influencers.length,
      connectedCount: influencers.length - pending.length,
      avgEr: ers.length ? ers.reduce((a, b) => a + b, 0) / ers.length : null,
      totalReach: reach.length ? reach.reduce((a, b) => a + b, 0) : null,
    },
    creators,
    pending,
  };
}

/** Pull fresh numbers from every connected platform and store them. */
export async function refreshInfluencer(influencerId: string): Promise<string[]> {
  const conns = await sql`select * from connections where influencer_id = ${influencerId}`;
  const done: string[] = [];

  for (const c of conns as any[]) {
    try {
      if (c.platform === "instagram") {
        let token = decrypt(c.access_token);
        const expiry = c.token_expires_at ? new Date(c.token_expires_at) : null;
        // IG long-lived tokens last 60d; refresh when within 5 days of expiry.
        if (expiry && expiry.getTime() - Date.now() < 5 * 864e5) {
          const r = await ig.refreshToken(token);
          token = r.accessToken;
          await sql`update connections set access_token = ${encrypt(token)},
                    token_expires_at = ${r.expiresAt.toISOString()}
                    where influencer_id = ${influencerId} and platform = 'instagram'`;
        }
        const s = await ig.fetchStats(token);
        await sql`
          insert into instagram_stats (influencer_id, username, avatar_url, followers, following, media_count,
                                       posts, account_insights, demographics, updated_at)
          values (${influencerId}, ${s.username}, ${s.avatarUrl}, ${s.followers}, ${s.following}, ${s.mediaCount},
                  ${JSON.stringify(s.posts)}::jsonb,
                  ${s.accountInsights ? JSON.stringify(s.accountInsights) : null}::jsonb,
                  ${s.demographics ? JSON.stringify(s.demographics) : null}::jsonb, now())
          on conflict (influencer_id) do update set
            username = excluded.username, avatar_url = excluded.avatar_url,
            followers = excluded.followers, following = excluded.following,
            media_count = excluded.media_count, posts = excluded.posts,
            account_insights = excluded.account_insights, demographics = excluded.demographics,
            updated_at = now()`;
        const postMetrics = s.posts.map((p: any) => ({
          id: p.id, timestamp: p.timestamp, likes: p.likes, comments: p.comments,
          reach: p.reach, saves: p.saves, shares: p.shares, views: p.views,
          totalInteractions: p.totalInteractions,
        }));
        await sql`
          insert into instagram_stats_history
            (influencer_id, followers, following, media_count, account_insights, demographics, post_metrics)
          values (${influencerId}, ${s.followers}, ${s.following}, ${s.mediaCount},
                  ${s.accountInsights ? JSON.stringify(s.accountInsights) : null}::jsonb,
                  ${s.demographics ? JSON.stringify(s.demographics) : null}::jsonb,
                  ${JSON.stringify(postMetrics)}::jsonb)`;
        done.push("instagram");
      }

      if (c.platform === "tiktok") {
        let token = decrypt(c.access_token);
        const expiry = c.token_expires_at ? new Date(c.token_expires_at) : null;
        // TikTok access tokens last ~24h; refresh if expired/near expiry.
        if (expiry && expiry.getTime() - Date.now() < 60_000 && c.refresh_token) {
          const r = await tt.refreshToken(decrypt(c.refresh_token));
          token = r.accessToken;
          await sql`update connections set access_token = ${encrypt(r.accessToken)},
                    refresh_token = ${encrypt(r.refreshToken)},
                    token_expires_at = ${r.expiresAt.toISOString()}
                    where influencer_id = ${influencerId} and platform = 'tiktok'`;
        }
        const s = await tt.fetchStats(token);
        await sql`
          insert into tiktok_stats (influencer_id, username, avatar_url, followers, following, likes_total,
                                    video_count, videos, updated_at)
          values (${influencerId}, ${s.username}, ${s.avatarUrl}, ${s.followers}, ${s.following}, ${s.likesTotal},
                  ${s.videoCount}, ${JSON.stringify(s.videos)}::jsonb, now())
          on conflict (influencer_id) do update set
            username = excluded.username, avatar_url = excluded.avatar_url,
            followers = excluded.followers, following = excluded.following,
            likes_total = excluded.likes_total, video_count = excluded.video_count,
            videos = excluded.videos, updated_at = now()`;
        const videoMetrics = s.videos.map((v: any) => ({
          id: v.id, createTime: v.createTime, views: v.views, likes: v.likes,
          comments: v.comments, shares: v.shares,
        }));
        await sql`
          insert into tiktok_stats_history
            (influencer_id, followers, following, likes_total, video_count, video_metrics)
          values (${influencerId}, ${s.followers}, ${s.following}, ${s.likesTotal},
                  ${s.videoCount}, ${JSON.stringify(videoMetrics)}::jsonb)`;
        done.push("tiktok");
      }
    } catch (err) {
      console.error(`refresh ${c.platform} failed for ${influencerId}:`, err);
    }
  }
  return done;
}
