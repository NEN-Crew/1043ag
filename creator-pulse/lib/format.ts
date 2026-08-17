/**
 * pt-BR formatting. One module, used everywhere — the screen is mostly
 * numbers, so an inconsistency here is glaring. Comma is the decimal
 * separator, period the thousands separator.
 */

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });

const DASH = "—";

/** A rate, one decimal: 4.2 → "4,2". The % is a separate element (§8.3). */
export function formatRate(n: number | null | undefined, decimals = 1): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return nf(decimals, decimals).format(n);
}

/** Whole numbers with pt-BR thousands separators: 12345 → "12.345". */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return nf(0, 0).format(Math.round(n));
}

/**
 * Counts are always exact.
 *
 * These used to be abbreviated — 9.629 seguidores rendered as "10k", 2.303
 * curtidas as "2 mil". Rounding to the nearest thousand is a 13% error at these
 * magnitudes, and a creator comparing the screen against their own profile sees
 * a number that is simply wrong. An exact figure costs three characters and
 * buys the whole dashboard its credibility back.
 */
export function formatCount(n: number | null | undefined): string {
  return formatNumber(n);
}

/**
 * A signed delta. `pp` = percentage points (for rates) and renders bare;
 * `pct` = percent (for counts) and carries a % sign. The arrow glyph is
 * drawn by CSS so colour and direction never disagree.
 */
export function formatDelta(value: number, unit: "pp" | "pct"): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const body = nf(1, 1).format(Math.abs(value));
  return unit === "pct" ? `${sign}${body}%` : `${sign}${body}`;
}

/** "62 : 1" — spaces around the colon. */
export function formatRatio(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return `${nf(0, 0).format(Math.round(n))} : 1`;
}

/** "5,2 posts / semana" */
export function formatCadence(n: number | null | undefined, noun = "posts"): string {
  if (n == null || !Number.isFinite(n)) return DASH;
  return `${nf(1, 1).format(n)} ${noun} / semana`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

/** "atualizado agora" / "atualizado há 3 dias" */
export function formatFreshness(iso: string | null | undefined): string {
  if (!iso) return "nunca atualizado";
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return "atualizado agora";
  if (hours < 24) return `atualizado há ${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  return `atualizado há ${days} ${days === 1 ? "dia" : "dias"}`;
}

/** "out/2025" — lowercase abbreviated pt-BR. */
export function formatMonth(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "")
    .replace(" de ", "/")
    .toLowerCase();
}

export const dash = DASH;
