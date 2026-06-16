// Instagram API with Instagram Login (host graph.instagram.com).
const AUTH = "https://api.instagram.com";
const GRAPH = "https://graph.instagram.com";
const SCOPES = "instagram_business_basic,instagram_business_manage_insights";

function redirectUri() {
  return `${process.env.APP_URL}/api/connect/instagram/callback`;
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

export async function fetchStats(accessToken: string) {
  const profileRes = await fetch(
    `${GRAPH}/me?` +
      new URLSearchParams({
        fields: "user_id,username,account_type,followers_count,follows_count,media_count",
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

  const posts = (media.data ?? []).map((m: any) => ({
    id: m.id,
    caption: m.caption ?? null,
    permalink: m.permalink ?? null,
    thumbnail: m.thumbnail_url ?? m.media_url ?? null,
    type: m.media_type ?? null,
    timestamp: m.timestamp ?? null,
    likes: m.like_count ?? null,
    comments: m.comments_count ?? null,
  }));

  return {
    username: profile.username ?? null,
    followers: profile.followers_count ?? null,
    following: profile.follows_count ?? null,
    mediaCount: profile.media_count ?? null,
    accountId: String(profile.user_id ?? ""),
    posts,
  };
}
