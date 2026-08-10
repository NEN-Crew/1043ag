import { sql } from "./db";
import { decrypt, encrypt } from "./crypto";
import * as ig from "./instagram";
import * as tt from "./tiktok";

export type Report = {
  influencer: { id: string; name: string; email: string };
  connected: { instagram: boolean; tiktok: boolean };
  instagram: any | null;
  tiktok: any | null;
};

export async function getReport(influencerId: string): Promise<Report | null> {
  const inf = (await sql`select id, name, email from influencers where id = ${influencerId}`)[0];
  if (!inf) return null;

  const conns = await sql`select platform from connections where influencer_id = ${influencerId}`;
  const igStats = (await sql`select * from instagram_stats where influencer_id = ${influencerId}`)[0] ?? null;
  const ttStats = (await sql`select * from tiktok_stats where influencer_id = ${influencerId}`)[0] ?? null;

  const platforms = new Set(conns.map((c: any) => c.platform));
  return {
    influencer: { id: inf.id, name: inf.name, email: inf.email },
    connected: { instagram: platforms.has("instagram"), tiktok: platforms.has("tiktok") },
    instagram: igStats,
    tiktok: ttStats,
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
