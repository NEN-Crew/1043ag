import { NextResponse } from "next/server";
import { getInfluencerId } from "@/lib/auth";
import { sign } from "@/lib/crypto";
import * as ig from "@/lib/instagram";
import * as tt from "@/lib/tiktok";

export const runtime = "nodejs";

// The logged-in influencer starts the OAuth flow for their own account.
export async function GET(_req: Request, { params }: { params: { platform: string } }) {
  const influencerId = getInfluencerId();
  if (!influencerId) return NextResponse.redirect(`${process.env.APP_URL}/login`);

  const platform = params.platform;
  const state = sign(`${influencerId}:${platform}`);
  let url: string;
  if (platform === "instagram") url = ig.authorizeUrl(state);
  else if (platform === "tiktok") url = tt.authorizeUrl(state);
  else return NextResponse.json({ error: "Unknown platform" }, { status: 404 });

  return NextResponse.redirect(url);
}
