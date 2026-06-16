import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { encrypt, unsign } from "@/lib/crypto";
import { refreshInfluencer } from "@/lib/report";
import * as ig from "@/lib/instagram";
import * as tt from "@/lib/tiktok";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { platform: string } }) {
  const platform = params.platform;
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? "";
  const back = (q: string) => NextResponse.redirect(`${process.env.APP_URL}/me?${q}`);

  if (searchParams.get("error") || !code) return back("connect=error");

  // state = signed "influencerId:platform"
  const raw = unsign(state);
  if (!raw) return back("connect=error");
  const [influencerId, statePlatform] = raw.split(":");
  if (statePlatform !== platform) return back("connect=error");

  try {
    if (platform === "instagram") {
      const t = await ig.exchangeCode(code);
      await sql`
        insert into connections (influencer_id, platform, account_id, access_token, token_expires_at)
        values (${influencerId}, 'instagram', ${t.accountId}, ${encrypt(t.accessToken)}, ${t.expiresAt.toISOString()})
        on conflict (influencer_id, platform) do update set
          account_id = excluded.account_id, access_token = excluded.access_token,
          token_expires_at = excluded.token_expires_at, connected_at = now()`;
    } else if (platform === "tiktok") {
      const t = await tt.exchangeCode(code);
      await sql`
        insert into connections (influencer_id, platform, account_id, access_token, refresh_token, token_expires_at)
        values (${influencerId}, 'tiktok', ${t.accountId}, ${encrypt(t.accessToken)}, ${encrypt(t.refreshToken)}, ${t.expiresAt.toISOString()})
        on conflict (influencer_id, platform) do update set
          account_id = excluded.account_id, access_token = excluded.access_token,
          refresh_token = excluded.refresh_token, token_expires_at = excluded.token_expires_at,
          connected_at = now()`;
    } else {
      return back("connect=error");
    }

    // Pull the first batch of numbers right away.
    await refreshInfluencer(influencerId);
    return back(`connected=${platform}`);
  } catch (err) {
    console.error("connect callback failed:", err);
    return back("connect=error");
  }
}
