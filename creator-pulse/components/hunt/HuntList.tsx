"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ProspectRow } from "@/lib/hunt-metrics";
import { HUNT_STATUSES, STATUS_LABEL } from "@/lib/hunt-status";
import { formatCount, formatFreshness, formatRate } from "@/lib/format";
import { Caption, Chip, SectionHead, Seg } from "../ui";
import { ChevronRight, PlatformIcon } from "../Icons";

type Network = "all" | "instagram" | "tiktok";

/**
 * Every prospect, newest data first. Filters live in the URL like the
 * ranking's, so a filtered list can be shared. At 390 px each row stacks.
 */
export default function HuntList({ rows }: { rows: ProspectRow[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const network = (params.get("rede") as Network) || "all";
  const status = params.get("status") || "all";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `/admin/hunt?${qs}` : "/admin/hunt", { scroll: false });
  }

  const shown = rows
    .filter((r) => network === "all" || r.platform === network)
    .filter((r) => status === "all" || r.status === status);

  if (rows.length === 0) {
    return (
      <section className="section">
        <SectionHead title="perfis buscados" />
        <div className="notice">Nenhum perfil buscado ainda. Comece pelo @ de alguém acima.</div>
      </section>
    );
  }

  return (
    <section className="section">
      <SectionHead
        title="perfis buscados"
        right={
          <Seg
            small
            label="Filtrar por status"
            value={status}
            onChange={(k) => setParam("status", k)}
            items={[{ key: "all", label: "todos" }, ...HUNT_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s] }))]}
          />
        }
      />
      <div className="rank-tools">
        <Seg
          cobalt
          label="Filtrar por rede"
          value={network}
          onChange={(k) => setParam("rede", k)}
          items={[
            { key: "all", label: "todas" },
            { key: "instagram", label: <><PlatformIcon platform="instagram" size={14} />instagram</> },
            { key: "tiktok", label: <><PlatformIcon platform="tiktok" size={14} />tiktok</> },
          ]}
        />
        <Caption>
          {shown.length} {shown.length === 1 ? "perfil" : "perfis"} · ordenados pela última atualização · er dos últimos 90
          dias
        </Caption>
      </div>

      <div className="card flush">
        <div className="hunt-head" aria-hidden="true">
          <span>perfil</span>
          <span style={{ textAlign: "right" }}>seguidores</span>
          <span style={{ textAlign: "right" }}>er</span>
          <span style={{ textAlign: "right" }}>views típicas</span>
          <span style={{ textAlign: "right" }}>posts/sem</span>
          <span>status</span>
          <span>atualizado</span>
          <span />
        </div>
        {shown.length === 0 ? (
          <div style={{ padding: "28px 22px", borderTop: "1px solid var(--line)" }} className="caption">
            Nenhum perfil com esse filtro.
          </div>
        ) : (
          shown.map((r) => (
            <div key={r.id} className="hunt-row">
              <span className="rank-id">
                <Avatar name={r.name} url={r.avatarUrl} />
                <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                  <Link href={r.href} className="rank-handle rank-link" title={`Abrir @${r.handle}`}>
                    {r.name}
                  </Link>
                  <span className="rank-sub">
                    @{r.handle} · <PlatformIcon platform={r.platform} size={11} /> {r.platform}
                  </span>
                </span>
              </span>
              <span className="hunt-num">
                {formatCount(r.followers)}
                <span className="only-narrow caption"> seguidores</span>
              </span>
              <span className="hunt-num">
                {r.er == null ? (
                  <span className="caption">—</span>
                ) : (
                  <>
                    <b>{formatRate(r.er)}%</b>
                    {r.platform === "instagram" && <span className="caption"> público</span>}
                  </>
                )}
                <span className="only-narrow caption"> er</span>
              </span>
              <span className="hunt-num">
                {formatCount(r.views)}
                <span className="only-narrow caption"> views típicas</span>
              </span>
              <span className="hunt-num">
                {r.postsPerWeek == null ? "—" : formatRate(r.postsPerWeek, 1)}
                <span className="only-narrow caption"> posts/sem</span>
              </span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip>{STATUS_LABEL[r.status]}</Chip>
                {r.bets && <Chip tone="dark">atenção</Chip>}
              </span>
              <span className="caption" style={{ whiteSpace: "nowrap" }}>{formatFreshness(r.fetchedAt)}</span>
              <span style={{ justifySelf: "end", color: "var(--line)" }}>
                <ChevronRight size={16} />
              </span>
            </div>
          ))
        )}
      </div>
      <Caption style={{ marginTop: 14, paddingLeft: 10 }}>
        Números públicos, não comparáveis com o roster. No Instagram o er é "público": curtidas + comentários ÷ seguidores,
        sem salvos e envios. "atenção" marca sinais de apostas na bio ou nos posts.
      </Caption>
    </section>
  );
}

export function Avatar({ name, url, size = 38 }: { name: string; url: string | null; size?: number }) {
  const style = { width: size, height: size };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="rank-avatar"
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      style={style}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).replaceWith(Object.assign(document.createElement("span"), {
          className: "rank-avatar",
          textContent: initials(name),
          style: `width:${size}px;height:${size}px`,
        }));
      }}
    />
  ) : (
    <span className="rank-avatar" style={style}>{initials(name)}</span>
  );
}

export function initials(name: string): string {
  return name
    .replace(/^@/, "")
    .split(/[\s._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
