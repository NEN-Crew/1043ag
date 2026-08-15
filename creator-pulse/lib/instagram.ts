// Instagram API with Instagram Login (host graph.instagram.com).
const AUTH = "https://api.instagram.com";
const GRAPH = "https://graph.instagram.com";
const SCOPES = "instagram_business_basic,instagram_business_manage_insights";

function redirectUri() {
  // Tolerate a trailing slash in APP_URL — a doubled slash here makes the
  // URI mismatch the one registered with Meta.
  return `${process.env.APP_URL!.replace(/\/+$/, "")}/api/connect/instagram/callback`;
}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    response_type: "code",
    state,
  });
  return `${AUTH}/oauth/authorize?${p}`;
}

export type IgToken = { accessToken: string; accountId: string; expiresAt: Date };

export async function exchangeCode(code: string): Promise<IgToken> {
  // 1) short-lived token (+ user_id)
  const shortRes = await fetch(`${AUTH}/oauth/access_token`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID!,
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
      code,
    }),
  });
  if (!shortRes.ok) throw new Error(`IG token exchange failed: ${await shortRes.text()}`);
  const short = await shortRes.json();

  // 2) long-lived token (60 days)
  const longRes = await fetch(
    `${GRAPH}/access_token?` +
      new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        access_token: short.access_token,
      })
  );
  if (!longRes.ok) throw new Error(`IG long-lived exchange failed: ${await longRes.text()}`);
  const long = await longRes.json();

  return {
    accessToken: long.access_token,
    accountId: String(short.user_id ?? ""),
    expiresAt: new Date(Date.now() + (long.expires_in ?? 5184000) * 1000),
  };
}

export async function refreshToken(accessToken: string): Promise<IgToken> {
  const res = await fetch(
    `${GRAPH}/refresh_access_token?` +
      new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken })
  );
  if (!res.ok) throw new Error(`IG refresh failed: ${await res.text()}`);
  const d = await res.json();
  return {
    accessToken: d.access_token,
    accountId: "",
    expiresAt: new Date(Date.now() + (d.expires_in ?? 5184000) * 1000),
  };
}

// Per-post insights. Not every media type/age supports every metric, so a
// failed call degrades to nulls instead of failing the whole refresh.
async function mediaInsights(mediaId: string, accessToken: string) {
  const res = await fetch(
    `${GRAPH}/${mediaId}/insights?` +
      new URLSearchParams({
        metric: "reach,saved,shares,views,total_interactions",
        access_token: accessToken,
      })
  );
  if (!res.ok) return null;
  const d = await res.json();
  const byName: Record<string, number> = {};
  for (const m of d.data ?? []) byName[m.name] = m.values?.[0]?.value;
  return {
    reach: byName.reach ?? null,
    saves: byName.saved ?? null,
    shares: byName.shares ?? null,
    views: byName.views ?? null,
    totalInteractions: byName.total_interactions ?? null,
  };
}

// Account-level totals. period=day is the only period every one of these
// metrics supports, so the numbers are "last day" totals.
async function accountInsights(accessToken: string) {
  const res = await fetch(
    `${GRAPH}/me/insights?` +
      new URLSearchParams({
        metric: "reach,views,accounts_engaged,total_interactions",
        period: "day",
        metric_type: "total_value",
        access_token: accessToken,
      })
  );
  if (!res.ok) {
    console.error(`IG account insights failed: ${await res.text()}`);
    return null;
  }
  const d = await res.json();
  const metrics: Record<string, number | null> = {};
  for (const m of d.data ?? []) metrics[m.name] = m.total_value?.value ?? null;
  return Object.keys(metrics).length ? { period: "day", metrics } : null;
}

// Follower demographics. Requires 100+ followers — below that the API errors,
// which we treat as "no data". One request per breakdown dimension.
async function followerDemographics(accessToken: string) {
  const out: Record<string, { key: string; value: number }[]> = {};
  for (const breakdown of ["age", "gender", "country"]) {
    const res = await fetch(
      `${GRAPH}/me/insights?` +
        new URLSearchParams({
          metric: "follower_demographics",
          period: "lifetime",
          timeframe: "this_month",
          breakdown,
          metric_type: "total_value",
          access_token: accessToken,
        })
    );
    if (!res.ok) continue;
    const d = await res.json();
    const results = d.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
    if (results.length) {
      out[breakdown] = results
        .map((r: any) => ({ key: String(r.dimension_values?.[0] ?? "?"), value: r.value ?? 0 }))
        .sort((a: any, b: any) => b.value - a.value);
    }
  }
  return Object.keys(out).length ? out : null;
}

export async function fetchStats(accessToken: string) {
  const profileRes = await fetch(
    `${GRAPH}/me?` +
      new URLSearchParams({
        // profile_picture_url is a CDN link that expires; we re-pull it on
        // every refresh and the UI degrades to a placeholder if it's gone.
        fields:
          "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count",
        access_token: accessToken,
      })
  );
  if (!profileRes.ok) throw new Error(`IG profile failed: ${await profileRes.text()}`);
  const profile = await profileRes.json();

  const mediaRes = await fetch(
    `${GRAPH}/me/media?` +
      new URLSearchParams({
        fields:
          "id,caption,media_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count",
        limit: "12",
        access_token: accessToken,
      })
  );
  const media = mediaRes.ok ? await mediaRes.json() : { data: [] };

  const basePosts = (media.data ?? []).map((m: any) => ({
    id: m.id,
    caption: m.caption ?? null,
    permalink: m.permalink ?? null,
    thumbnail: m.thumbnail_url ?? m.media_url ?? null,
    type: m.media_type ?? null,
    timestamp: m.timestamp ?? null,
    likes: m.like_count ?? null,
    comments: m.comments_count ?? null,
  }));

  const [postInsights, account, demographics] = await Promise.all([
    Promise.all(basePosts.map((p: any) => mediaInsights(p.id, accessToken).catch(() => null))),
    accountInsights(accessToken).catch(() => null),
    followerDemographics(accessToken).catch(() => null),
  ]);
  const posts = basePosts.map((p: any, i: number) => ({ ...p, ...(postInsights[i] ?? {}) }));

  return {
    username: profile.username ?? null,
    avatarUrl: profile.profile_picture_url ?? null,
    followers: profile.followers_count ?? null,
    following: profile.follows_count ?? null,
    mediaCount: profile.media_count ?? null,
    accountId: String(profile.user_id ?? ""),
    posts,
    accountInsights: account,
    demographics,
  };
}
