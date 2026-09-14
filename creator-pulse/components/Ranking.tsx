"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AgencyRoster, RosterEntry } from "@/lib/report";
import { formatCount, formatFreshness, formatNumber, formatRate } from "@/lib/format";
import { Caption, DeltaTag, SectionHead, Seg, VerdictChip } from "./ui";
import { AlertTriangle, ChevronRight, Clock, Info, Insights, PlatformIcon } from "./Icons";

type SortKey = "er" | "followers" | "growth";
type Network = "all" | "instagram" | "tiktok";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "er", label: "engajamento" },
  { key: "followers", label: "seguidores" },
  { key: "growth", label: "crescimento" },
];

const NETWORKS: { key: Network; label: string }[] = [
  { key: "all", label: "todas" },
  { key: "instagram", label: "instagram" },
  { key: "tiktok", label: "tiktok" },
];

/**
 * The roster, ranked. Comparing an Instagram ER against a TikTok ER is
 * meaningless, so the network filter is what produces a like-for-like
 * ranking, and the bar scale is relative to the filtered set.
 */
export default function Ranking({ roster }: { roster: AgencyRoster }) {
  const router = useRouter();
  const params = useSearchParams();

  const network = (params.get("rede") as Network) || "all";
  const sort = (params.get("ordem") as SortKey) || "er";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all" || (key === "ordem" && value === "er")) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `/admin?${qs}` : "/admin", { scroll: false });
  }

  const { rows, maxEr } = useMemo(() => {
    const filtered = network === "all" ? roster.creators : roster.creators.filter((c) => c.platform === network);
    const value = (c: RosterEntry) =>
      sort === "er" ? c.er ?? -1 : sort === "followers" ? c.followers ?? -1 : c.growth ?? -1;
    const sorted = [...filtered].sort((a, b) => value(b) - value(a));
    return { rows: sorted, maxEr: Math.max(1, ...sorted.map((c) => c.er ?? 0)) };
  }, [roster.creators, network, sort]);

  const sortLabel = SORTS.find((s) => s.key === sort)!.label;
  const cpm = roster.creators.find((c) => c.mediaValue)?.mediaValue ?? null;
  const netLabel = NETWORKS.find((n) => n.key === network)!.label;

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <SectionHead
        title="ranking de creators"
        right={<Seg label="Ordenar por" value={sort} onChange={(k) => setParam("ordem", k)} items={SORTS} />}
      />

      <div className="rank-tools">
        <Seg
          cobalt
          label="Filtrar por rede"
          value={network}
          onChange={(k) => setParam("rede", k)}
          items={NETWORKS.map((n) => ({
            key: n.key,
            label: (
              <>
                {n.key !== "all" && <PlatformIcon platform={n.key as "instagram" | "tiktok"} size={14} />}
                {n.label}
              </>
            ),
          }))}
        />
        <Caption>
          {rows.length} {rows.length === 1 ? "conta" : "contas"}
          {network !== "all" ? ` · comparando apenas ${netLabel}` : " · filtre por rede para comparar contas da mesma plataforma"}
        </Caption>
      </div>

      <div className="card flush">
        <div className="rank-head" aria-hidden="true" style={{ paddingTop: 16 }}>
          <span style={{ textAlign: "center" }}>#</span>
          <span>creator</span>
          <span>rede</span>
          <span>engajamento</span>
          <span style={{ textAlign: "right" }}>seguidores</span>
          <span style={{ textAlign: "right" }}>valor / post</span>
          <span style={{ textAlign: "right" }}>veredito</span>
          <span />
          <span />
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "28px 22px", borderTop: "1px solid var(--line)" }} className="caption">
            Nenhum creator nessa rede.
          </div>
        ) : (
          rows.map((c, i) => (
            <div key={`${c.creatorId}-${c.platform}`} className="rank-row">
              <span className={`rank-n${i < 3 ? " top" : ""}`}>{String(i + 1).padStart(2, "0")}</span>

              <span className="rank-id">
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="rank-avatar" src={c.avatarUrl} alt="" />
                ) : (
                  <span className="rank-avatar">{initials(c.name)}</span>
                )}
                <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <Link
                    href={`/admin/${c.creatorId}?rede=${c.platform}`}
                    className="rank-handle rank-link"
                    title={`Abrir perfil de ${c.handle ? `@${c.handle}` : c.name}`}
                  >
                    {c.handle ? `@${c.handle}` : c.name}
                  </Link>
                  <span className="rank-sub">{c.name}</span>
                </span>
              </span>

              <span className="rank-net">
                <PlatformIcon platform={c.platform} size={15} />
                {c.platformLabel.toLowerCase()}
              </span>

              <span className="rank-er">
                <span className="rank-bar">
                  <span
                    className={`rank-bar-fill${sort === "er" ? "" : " sorted"}`}
                    style={{ width: `${((c.er ?? 0) / maxEr) * 100}%` }}
                  />
                </span>
                <span className="rank-er-val">
                  <span className="n">{formatRate(c.er)}%</span>
                  <DeltaTag delta={c.erDelta} />
                </span>
              </span>

              <span className="rank-followers">
                <span>
                  {formatCount(c.followers)}
                  <span className="only-narrow caption" style={{ marginLeft: 6 }}>seguidores</span>
                </span>
                <DeltaTag delta={c.growthDelta} />
              </span>

              <span className={`rank-value${c.mediaValue ? "" : " empty"}`}>
                {c.mediaValue
                  ? `${c.mediaValue.currency} ${formatNumber(c.mediaValue.low)} a ${formatNumber(c.mediaValue.high)}`
                  : "–"}
                <span className="only-narrow caption" style={{ marginLeft: 6 }}>por post</span>
              </span>

              <span className="rank-verdict">
                <VerdictChip verdict={c.verdict} />
              </span>

              <Link
                href={`/admin/${c.creatorId}/insights?rede=${c.platform}`}
                className="rank-insights"
                title="Insights"
                aria-label={`Insights de ${c.handle ? `@${c.handle}` : c.name} no ${c.platformLabel}`}
              >
                <Insights size={15} />
              </Link>

              <span style={{ justifySelf: "end", color: "var(--line)" }}>
                <ChevronRight size={16} />
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ padding: "14px 10px 0", display: "grid", gap: 8 }}>
        <Freshness at={roster.meta.lastUpdatedAt} />
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Info size={13} style={{ marginTop: 2, color: "var(--ink-500)" }} />
          <Caption>
            Ranqueado por {sortLabel}. Clique numa linha para abrir o perfil; o ícone de barras abre os insights.
          </Caption>
        </div>
        {cpm && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Info size={13} style={{ marginTop: 2, color: "var(--ink-500)" }} />
            <Caption>
              Valor / post: views de um post típico a um CPM de {cpm.currency} {cpm.cpm[0]} a {cpm.cpm[1]}. Piso de mídia
              comprada, não tabela de preços. Só a agência vê esse número.
            </Caption>
          </div>
        )}
      </div>

      {roster.pending.length > 0 && (
        <div className="card" style={{ marginTop: 26 }}>
          <div className="label-lg" style={{ marginBottom: 12 }}>
            aguardando conexão · {roster.pending.length}
          </div>
          <div className="pending">
            {roster.pending.map((p) => (
              <div key={p.id}>
                <b>{p.name}</b>
                <span className="caption">{p.email}</span>
              </div>
            ))}
          </div>
          <Caption style={{ marginTop: 12 }}>Envie o login para essas pessoas conectarem Instagram ou TikTok.</Caption>
        </div>
      )}
    </section>
  );
}

/** The daily cron can stop silently; the data just ages. So it says so. */
function Freshness({ at }: { at: string | null }) {
  if (!at) return null;
  const days = (Date.now() - new Date(at).getTime()) / 86_400_000;
  const stale = days > 2;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", color: stale ? "var(--ink)" : "var(--ink-500)" }}>
      {stale ? <AlertTriangle size={13} style={{ marginTop: 2 }} /> : <Clock size={13} style={{ marginTop: 2 }} />}
      <Caption style={stale ? { color: "var(--ink)" } : undefined}>
        {stale
          ? `Dados ${formatFreshness(at)}. A atualização diária pode ter parado. Verifique CRON_SECRET na Vercel.`
          : `Dados ${formatFreshness(at)} · atualização automática diária`}
      </Caption>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
