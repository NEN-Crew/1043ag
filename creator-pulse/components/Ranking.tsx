"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AgencyRoster, RosterEntry } from "@/lib/report";
import { formatCount, formatRate } from "@/lib/format";
import { Caption, DeltaTag, Eyebrow, VerdictChip } from "./ui";
import { ChevronRight, Grid, Info, PlatformIcon } from "./Icons";

type SortKey = "er" | "followers" | "growth";
type Network = "all" | "instagram" | "tiktok";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "er", label: "Engajamento" },
  { key: "followers", label: "Seguidores" },
  { key: "growth", label: "Crescimento" },
];

const NETWORKS: { key: Network; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
];

/**
 * The roster, ranked. Comparing an Instagram ER against a TikTok ER is
 * meaningless — the platforms have structurally different baselines — so the
 * network filter is what produces a like-for-like ranking, and the bar scale
 * is relative to the filtered set, not the whole roster.
 */
export default function Ranking({ roster }: { roster: AgencyRoster }) {
  const router = useRouter();
  const params = useSearchParams();

  const network = (params.get("rede") as Network) || "all";
  const sort = (params.get("ordem") as SortKey) || "er";

  // Filter and sort live in the URL so a filtered ranking is shareable and
  // survives a refresh.
  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all" || (key === "ordem" && value === "er")) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `/admin?${qs}` : "/admin", { scroll: false });
  }

  const { rows, maxEr } = useMemo(() => {
    const filtered =
      network === "all" ? roster.creators : roster.creators.filter((c) => c.platform === network);

    const value = (c: RosterEntry) =>
      sort === "er" ? c.er ?? -1 : sort === "followers" ? c.followers ?? -1 : c.growth ?? -1;

    const sorted = [...filtered].sort((a, b) => value(b) - value(a));
    // Relative to the FILTERED set — that's what makes the bars comparable.
    return { rows: sorted, maxEr: Math.max(1, ...sorted.map((c) => c.er ?? 0)) };
  }, [roster.creators, network, sort]);

  const sortLabel = SORTS.find((s) => s.key === sort)!.label.toLowerCase();
  const netLabel = NETWORKS.find((n) => n.key === network)!.label;

  return (
    <section className="section first">
      <div className="section-body">
        <div className="section-head">
          <div>
            <Eyebrow>
              Ranking · {rows.length} {rows.length === 1 ? "conta" : "contas"}
              {network !== "all" && ` · ${netLabel}`}
            </Eyebrow>
            <h2 className="sec-title" style={{ marginTop: 10 }}>ranking de creators</h2>
          </div>
          <div className="segbox" role="tablist" aria-label="Ordenar por">
            {SORTS.map((s) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={sort === s.key}
                className="seg seg-lg"
                onClick={() => setParam("ordem", s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "22px 0" }}>
          <span className="micro">Rede</span>
          <div className="segbox" role="tablist" aria-label="Filtrar por rede">
            {NETWORKS.map((n) => (
              <button
                key={n.key}
                role="tab"
                aria-selected={network === n.key}
                className="seg"
                onClick={() => setParam("rede", n.key)}
              >
                {n.key === "all" ? <Grid size={13} /> : <PlatformIcon platform={n.key as any} size={13} />}
                {n.label}
              </button>
            ))}
          </div>
          {network !== "all" && (
            <span style={{ fontSize: 11, color: "var(--ink-400)" }}>comparando apenas {netLabel}</span>
          )}
        </div>

        <div className="rank-row rank-head" aria-hidden="true">
          <span className="colhead" style={{ textAlign: "center" }}>#</span>
          <span className="colhead">Creator</span>
          <span className="colhead">Rede</span>
          <span className="colhead">Engajamento</span>
          <span className="colhead" style={{ textAlign: "right" }}>Seguidores</span>
          <span className="colhead" style={{ textAlign: "right" }}>Veredito</span>
          <span />
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "28px 14px", borderTop: "1px solid var(--line)", fontSize: 13, color: "var(--ink-400)" }}>
            Nenhum creator nessa rede.
          </div>
        ) : (
          rows.map((c, i) => (
            <Link
              key={`${c.creatorId}-${c.platform}`}
              href={`/admin/${c.creatorId}`}
              className="rank-row"
              title={`Abrir perfil de ${c.handle ? `@${c.handle}` : c.name}`}
            >
              <span className={`rank-n${i < 3 ? " top" : ""}`}>{String(i + 1).padStart(2, "0")}</span>

              <span className="rank-id">
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="rank-avatar" src={c.avatarUrl} alt="" />
                ) : (
                  <span className="rank-avatar" style={{ background: fillFor(c.creatorId) }}>
                    {initials(c.name)}
                  </span>
                )}
                <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span className="rank-handle">{c.handle ? `@${c.handle}` : c.name}</span>
                  <span className="rank-sub">{c.name}</span>
                </span>
              </span>

              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", fontSize: 12, color: "var(--ink-500)" }}>
                <PlatformIcon platform={c.platform} size={15} />
                {c.platformLabel}
              </span>

              <span className="rank-er">
                <span className="rank-bar">
                  <span
                    className={`rank-bar-fill${sort === "er" ? " sorted" : ""}`}
                    style={{ width: `${((c.er ?? 0) / maxEr) * 100}%` }}
                  />
                </span>
                <span className="rank-er-val">
                  <span className="n">{formatRate(c.er)}%</span>
                  <DeltaTag delta={c.erDelta} />
                </span>
              </span>

              <span className="rank-followers">
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  {formatCount(c.followers)}
                  {/* The count is ambiguous once the column head is gone. */}
                  <span className="only-narrow colhead" style={{ marginLeft: 6 }}>seguidores</span>
                </span>
                <DeltaTag delta={c.growthDelta} />
              </span>

              <span className="rank-verdict" style={{ justifySelf: "end" }}>
                <VerdictChip verdict={c.verdict} />
              </span>

              <span style={{ justifySelf: "end", color: "var(--ink-300)" }}>
                <ChevronRight size={16} />
              </span>
            </Link>
          ))
        )}

        <div style={{ display: "flex", gap: 8, paddingTop: 16, alignItems: "flex-start" }}>
          <Info size={13} />
          <Caption>
            {network === "all"
              ? `Ranqueado por ${sortLabel} · filtre por rede para comparar contas da mesma plataforma · clique numa linha para abrir o perfil individual.`
              : `${netLabel} · ranqueado por ${sortLabel} · clique numa linha para abrir o perfil individual.`}
          </Caption>
        </div>

        {roster.pending.length > 0 && (
          <div style={{ marginTop: 34, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <div style={{ marginBottom: 12 }}>
              <span className="micro">Aguardando conexão · {roster.pending.length}</span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {roster.pending.map((p) => (
                <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
                  <span className="caption">{p.email}</span>
                </div>
              ))}
            </div>
            <Caption style={{ marginTop: 12 }}>
              Envie o login para essas pessoas conectarem Instagram ou TikTok — sem conexão não há números.
            </Caption>
          </div>
        )}
      </div>
      <div className="section-index" aria-hidden="true">01</div>
    </section>
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

/** Deterministic per creator, so a face never changes colour between loads. */
function fillFor(id: string): string {
  const palette = ["var(--cobalt)", "var(--accent)", "var(--ink)", "var(--ink-400)"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
