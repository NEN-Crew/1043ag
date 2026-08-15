import { sql } from "./db";
import { decrypt, encrypt } from "./crypto";
import { GrowthByPlatform, getGrowth } from "./history";
import { Analysis, Audience, analyze, audienceFrom, overallScore } from "./metrics";
import * as ig from "./instagram";
import * as tt from "./tiktok";

export type Report = {
  influencer: { id: string; name: string; email: string };
  connected: { instagram: boolean; tiktok: boolean };
  instagram: any | null;
  tiktok: any | null;
  /** The raw numbers turned into something you can act on. */
  analysis: { instagram: Analysis | null; tiktok: Analysis | null };
  growth: GrowthByPlatform;
  audience: Audience | null;
  /** Follower-weighted score across the connected platforms. */
  overall: number | null;
  totalFollowers: number | null;
  /** Both platforms rolled into the numbers the roster sorts on. */
  summary: {
    viewsPerPost: number | null;
    /** Total typical interactions ÷ total followers, so the bigger account weighs more. */
    engagementRate: number | null;
    mediaValue: Analysis["mediaValue"];
    updatedAt: string | null;
  };
};

function summarise(analyses: (Analysis | null)[]): Report["summary"] {
  const xs = analyses.filter((a): a is Analysis => a != null);
  const add = (pick: (a: Analysis) => number | null | undefined) => {
    const vals = xs.map(pick).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };

  const followers = add((a) => a.followers);
  const interactions = add((a) => a.typical.interactions);
  const low = add((a) => a.mediaValue?.low);
  const high = add((a) => a.mediaValue?.high);
  const band = xs.find((a) => a.mediaValue)?.mediaValue;

  return {
    viewsPerPost: add((a) => a.typical.views),
    engagementRate: interactions != null && followers ? (interactions / followers) * 100 : null,
    mediaValue:
      low != null && high != null && band ? { low, high, currency: band.currency, cpm: band.cpm } : null,
    updatedAt: xs.map((a) => a.updatedAt).filter(Boolean).sort().slice(-1)[0] ?? null,
  };
}

function assemble(
  inf: { id: string; name: string; email: string },
  platforms: Set<string>,
  igStats: any | null,
  ttStats: any | null,
  growth: GrowthByPlatform
): Report {
  const analysis = {
    instagram: platforms.has("instagram") ? analyze("instagram", igStats) : null,
    tiktok: platforms.has("tiktok") ? analyze("tiktok", ttStats) : null,
  };
  const followers = [igStats?.followers, ttStats?.followers].filter((f) => f != null) as number[];

  return {
    influencer: inf,
    connected: { instagram: platforms.has("instagram"), tiktok: platforms.has("tiktok") },
    instagram: igStats,
    tiktok: ttStats,
    analysis,
    growth,
    audience: audienceFrom(igStats?.demographics),
    overall: overallScore([analysis.instagram, analysis.tiktok]),
    totalFollowers: followers.length ? followers.reduce((a, b) => a + b, 0) : null,
    summary: summarise([analysis.instagram, analysis.tiktok]),
  };
}

export async function getReport(influencerId: string): Promise<Report | null> {
  const inf = (await sql`select id, name, email from influencers where id = ${influencerId}`)[0];
  if (!inf) return null;

  const [conns, igRows, ttRows, growth] = await Promise.all([
    sql`select platform from connections where influencer_id = ${influencerId}`,
    sql`select * from instagram_stats where influencer_id = ${influencerId}`,
    sql`select * from tiktok_stats where influencer_id = ${influencerId}`,
    getGrowth([influencerId]),
  ]);

  const platforms = new Set((conns as any[]).map((c) => c.platform));
  return assemble(
    { id: inf.id, name: inf.name, email: inf.email },
    platforms,
    igRows[0] ?? null,
    ttRows[0] ?? null,
    growth.get(influencerId) ?? { instagram: null, tiktok: null }
  );
}

/**
 * Every creator, fully analysed, in a fixed number of queries. The admin page
 * used to fetch one report per creator from the browser; the roster is the
 * whole point of that page, so it's built server-side in one pass.
 */
export async function getRoster(): Promise<Report[]> {
  const influencers = (await sql`
    select id, name, email from influencers order by created_at desc
  `) as any[];
  if (!influencers.length) return [];

  const ids = influencers.map((i) => i.id);
  const [conns, igRows, ttRows, growth] = await Promise.all([
    sql`select influencer_id, platform from connections where influencer_id = any(${ids}::text[])`,
    sql`select * from instagram_stats where influencer_id = any(${ids}::text[])`,
    sql`select * from tiktok_stats where influencer_id = any(${ids}::text[])`,
    getGrowth(ids),
  ]);

  const platformsBy = new Map<string, Set<string>>();
  for (const c of conns as any[]) {
    const set = platformsBy.get(c.influencer_id) ?? new Set<string>();
    set.add(c.platform);
    platformsBy.set(c.influencer_id, set);
  }
  const igBy = new Map((igRows as any[]).map((r) => [r.influencer_id, r]));
  const ttBy = new Map((ttRows as any[]).map((r) => [r.influencer_id, r]));

  return influencers.map((inf) =>
    assemble(
      { id: inf.id, name: inf.name, email: inf.email },
      platformsBy.get(inf.id) ?? new Set(),
      igBy.get(inf.id) ?? null,
      ttBy.get(inf.id) ?? null,
      growth.get(inf.id) ?? { instagram: null, tiktok: null }
    )
  );
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
          insert into instagram_stats (influencer_id, username, followers, following, media_count, posts,
                                       account_insights, demographics, updated_at)
          values (${influencerId}, ${s.username}, ${s.followers}, ${s.following}, ${s.mediaCount},
                  ${JSON.stringify(s.posts)}::jsonb,
                  ${s.accountInsights ? JSON.stringify(s.accountInsights) : null}::jsonb,
                  ${s.demographics ? JSON.stringify(s.demographics) : null}::jsonb, now())
          on conflict (influencer_id) do update set
            username = excluded.username, followers = excluded.followers, following = excluded.following,
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
          insert into tiktok_stats (influencer_id, username, followers, following, likes_total, video_count, videos, updated_at)
          values (${influencerId}, ${s.username}, ${s.followers}, ${s.following}, ${s.likesTotal},
                  ${s.videoCount}, ${JSON.stringify(s.videos)}::jsonb, now())
          on conflict (influencer_id) do update set
            username = excluded.username, followers = excluded.followers, following = excluded.following,
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
