/**
 * The agency's numbers as CSV, one file for accounts and one for posts.
 *
 * Built for Excel and Google Sheets in pt-BR: semicolon-separated, decimal
 * comma, UTF-8 with a BOM so accents survive a double-click open. Every value
 * comes from the same analysed report the screens render, so a cell here
 * always matches what the ranking shows.
 */
import type { CreatorReport } from "./report";
import { growthOf } from "./report";
import type { PlatformView, Post } from "./metrics";
import { isPaid } from "./metrics";

const SEP = ";";
const BOM = "﻿";

function cell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v).replace(".", ",") : "";
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rates to two decimals, counts as-is. */
const rate = (n: number | null | undefined, d = 2) => (n == null ? null : Number(n.toFixed(d)));
/** Postgres timestamps arrive as Date objects, post dates as ISO strings. */
const day = (at: string | Date | null | undefined) =>
  at ? new Date(at).toISOString().slice(0, 10) : null;

function csv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(cell).join(SEP));
  return BOM + lines.join("\r\n") + "\r\n";
}

const STANDOUT: Record<string, string> = { viral: "Viral", high: "Acima", low: "Abaixo" };

/** The component strip renders "41.0%" / "-"; the sheet wants a number or nothing. */
function component(v: PlatformView, key: string): number | null {
  const n = Number((v.components.find((c) => c.key === key)?.display ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

function sumOf(v: PlatformView, kind: string): number | null {
  return v.engagement.breakdown.find((b) => b.kind === kind)?.count ?? null;
}

/** One row per account (creator × network), ranked by engagement like the screen. */
export function accountsCsv(reports: CreatorReport[]): string {
  const rows: unknown[][] = [];

  for (const r of reports) {
    for (const v of r.platforms) {
      rows.push([
        r.influencer.name,
        r.influencer.email,
        v.label,
        v.handle ? `@${v.handle}` : null,
        v.followers,
        rate(growthOf(v)),
        rate(v.engagement.rate),
        rate(v.engagement.delta?.value),
        v.engagement.verdict?.label ?? null,
        v.score,
        v.scoreVerdict?.label ?? null,
        v.window.posts,
        rate(v.postsPerWeek, 1),
        v.platform === "instagram" ? v.typical.reach ?? v.typical.views : v.typical.views,
        v.typical.likes,
        v.typical.comments,
        sumOf(v, "likes"),
        sumOf(v, "comments"),
        sumOf(v, "saves"),
        sumOf(v, "shares"),
        rate(v.engagement.byReach),
        component(v, "reach"),
        component(v, "impact"),
        v.content.paid.length,
        v.content.all.filter((p) => p.standout === "viral").length,
        v.mediaValue ? Math.round(v.mediaValue.low) : null,
        v.mediaValue ? Math.round(v.mediaValue.high) : null,
        v.mediaValue?.currency ?? null,
        // Demographics come from Instagram only; a TikTok row must not borrow them.
        v.platform === "instagram" ? r.audience?.summary ?? null : null,
        `${day(v.window.from)} a ${day(v.window.to)}`,
        day(v.updatedAt),
      ]);
    }
  }

  // Same order as the ranking: engagement, highest first. Column 7 is the rate.
  rows.sort((a, b) => ((b[6] as number) ?? -1) - ((a[6] as number) ?? -1));
  rows.forEach((row, i) => row.unshift(i + 1));

  return csv(
    [
      "#",
      "Creator",
      "E-mail",
      "Rede",
      "Conta",
      "Seguidores",
      "Crescimento no período (%)",
      "Engajamento (%)",
      "Variação engajamento (pp)",
      "Veredito",
      "Pulse score",
      "Veredito score",
      "Posts no período",
      "Posts por semana",
      "Alcance ou views típicos",
      "Curtidas típicas",
      "Comentários típicos",
      "Curtidas no período",
      "Comentários no período",
      "Salvos no período",
      "Enviados no período",
      "Engajamento sobre alcance (%)",
      "Alcance sobre seguidores (%)",
      "Impacto (%)",
      "Publis no período",
      "Posts virais",
      "Valor de mídia mín.",
      "Valor de mídia máx.",
      "Moeda",
      "Audiência",
      "Período",
      "Atualizado em",
    ],
    rows
  );
}

/** One row per post in the window, every account, highest engagement first per account. */
export function postsCsv(reports: CreatorReport[]): string {
  const rows: unknown[][] = [];

  for (const r of reports) {
    for (const v of r.platforms) {
      for (const p of v.content.all as Post[]) {
        rows.push([
          r.influencer.name,
          v.label,
          v.handle ? `@${v.handle}` : null,
          day(p.postedAt),
          p.formatLabel,
          p.caption.length > 200 ? `${p.caption.slice(0, 197)}…` : p.caption,
          p.likes,
          p.comments,
          p.saves,
          p.shares,
          p.views,
          p.reach,
          rate(p.er),
          rate(p.reachRate),
          rate(p.reachMultiple, 1),
          p.standout ? STANDOUT[p.standout] : null,
          isPaid(p) ? "Sim" : "Não",
          p.permalink,
        ]);
      }
    }
  }

  return csv(
    [
      "Creator",
      "Rede",
      "Conta",
      "Data",
      "Formato",
      "Legenda",
      "Curtidas",
      "Comentários",
      "Salvos",
      "Enviados",
      "Views",
      "Alcance",
      "Engajamento (%)",
      "Engajamento sobre alcance (%)",
      "Alcance × seguidores",
      "Destaque",
      "Publi",
      "Link",
    ],
    rows
  );
}
