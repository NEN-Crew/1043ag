// Counts are whole things. Medians of an even number of posts land on a .5, and
// "210.5 likes" reads like a bug, so display rounds.
export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

export function full(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Status colour for a 0–100 score. The thresholds are the grade boundaries, so
 * a bar never reads as a warning while the label beside it says "Solid".
 */
export function toneFor(score: number | null | undefined): "pos" | "warn" | "neg" | "none" {
  if (score == null) return "none";
  if (score >= 55) return "pos";
  if (score >= 40) return "warn";
  return "neg";
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
