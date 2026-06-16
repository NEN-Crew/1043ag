// TikTok Login Kit + Display API (host open.tiktokapis.com).
const AUTH = "https://www.tiktok.com/v2/auth/authorize/";
const API = "https://open.tiktokapis.com";
const SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.list";

function redirectUri() {
  return `${process.env.APP_URL}/api/connect/tiktok/callback`;
}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTH}?${p}`;
}

export type TtToken = {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  expiresAt: Date;
};

async function tokenRequest(body: Record<string, string>): Promise<TtToken> {
  const res = await fetch(`${API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(`TikTok token failed: ${d.error_description ?? d.error ?? res.status}`);
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    accountId: d.open_id ?? "",
    expiresAt: new Date(Date.now() + (d.expires_in ?? 86400) * 1000),
  };
}

export function exchangeCode(code: string) {
  return tokenRequest({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    client_secret: process.env.TIKTOK_CLIENT_SECRET!,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
}

export function refreshToken(refresh: string) {
  return tokenRequest({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    client_secret: process.env.TIKTOK_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
}

export async function fetchStats(accessToken: string) {
  const userRes = await fetch(
    `${API}/v2/user/info/?` +
      new URLSearchParams({
        fields: "open_id,display_name,follower_count,following_count,likes_count,video_count",
      }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!userRes.ok) throw new Error(`TikTok user failed: ${await userRes.text()}`);
  const user = (await userRes.json())?.data?.user ?? {};

  const videoRes = await fetch(
    `${API}/v2/video/list/?` +
      new URLSearchParams({
        fields:
          "id,title,video_description,cover_image_url,share_url,create_time,view_count,like_count,comment_count,share_count",
      }),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ max_count: 12 }),
    }
  );
  const videoData = videoRes.ok ? (await videoRes.json())?.data : { videos: [] };

  const videos = (videoData?.videos ?? []).map((v: any) => ({
    id: v.id,
    title: v.title || v.video_description || null,
    shareUrl: v.share_url ?? null,
    cover: v.cover_image_url ?? null,
    createTime: v.create_time ?? null,
    views: v.view_count ?? null,
    likes: v.like_count ?? null,
    comments: v.comment_count ?? null,
    shares: v.share_count ?? null,
  }));

  return {
    username: user.display_name ?? null,
    followers: user.follower_count ?? null,
    following: user.following_count ?? null,
    likesTotal: user.likes_count ?? null,
    videoCount: user.video_count ?? null,
    accountId: user.open_id ?? "",
    videos,
  };
}
