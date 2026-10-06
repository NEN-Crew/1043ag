/**
 * Turns whatever staff paste into the search box into a (platform, handle)
 * pair, or a reason it can't be one. Pure, so the API route and the search
 * card run the exact same rule.
 */
import type { Platform } from "./metrics";

export type ParsedHandle = { platform: Platform; handle: string };

// What each network accepts as a handle. Both are lowercase-only after
// normalisation: Instagram and TikTok handles are case-insensitive, and the
// (platform, handle) unique key relies on one spelling per account.
const HANDLE_RE: Record<Platform, RegExp> = {
  instagram: /^[a-z0-9._]{1,30}$/,
  tiktok: /^[a-z0-9._]{2,24}$/,
};

/** The network a pasted link belongs to, or null for a bare handle. */
export function platformFromInput(raw: string): Platform | null {
  const s = raw.trim().toLowerCase();
  if (/(^|\/\/|\.)instagram\.com\//.test(s) || /^instagram\.com\//.test(s)) return "instagram";
  if (/(^|\/\/|\.)tiktok\.com\//.test(s) || /^tiktok\.com\//.test(s)) return "tiktok";
  return null;
}

/**
 * Accepts "@handle", "handle", "instagram.com/handle/", "tiktok.com/@handle",
 * with or without scheme, "www." and query strings. A link decides the
 * platform; a bare handle takes the one the staff selected.
 */
export function parseHandle(raw: string, selected: Platform | null | undefined): ParsedHandle | null {
  const s = (raw ?? "").trim();
  if (!s) return null;

  const fromLink = platformFromInput(s);
  let handle = s.toLowerCase();

  if (fromLink) {
    // First path segment after the host, without the leading "@".
    const path = handle.replace(/^[a-z]+:\/\//, "").replace(/^[^/]*\//, "");
    const seg = path.split(/[/?#]/)[0] ?? "";
    handle = seg;
    // instagram.com/p/… and tiktok.com/video/… are posts, not profiles.
    if (["p", "reel", "reels", "video", "explore", "stories", "tv", "foryou", "discover"].includes(handle)) return null;
  }

  handle = handle.replace(/^@+/, "").replace(/\/+$/, "");
  const platform = fromLink ?? selected ?? null;
  if (!platform) return null;
  if (!HANDLE_RE[platform].test(handle)) return null;
  return { platform, handle };
}

export function profileUrl(platform: Platform, handle: string): string {
  return platform === "instagram" ? `https://www.instagram.com/${handle}/` : `https://www.tiktok.com/@${handle}`;
}

export const PLATFORM_LABEL: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok" };
