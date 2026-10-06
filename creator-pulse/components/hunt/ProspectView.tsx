"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Prospect, ProspectPost } from "@/lib/hunt-metrics";
import { HUNT_DEFAULT_WINDOW } from "@/lib/hunt-status";
import { WINDOWS } from "@/lib/metrics";
import { BETS_BAN_DATE } from "@/lib/hunt-flags";
import { errorCopy } from "@/lib/hunt-copy";
import { dash, formatCount, formatDate, formatFreshness, formatNumber, formatRate } from "@/lib/format";
import { Caption, Chip, SectionHead, Seg, Sparkline } from "../ui";
import TopBar, { creatorStats } from "../TopBar";
import { AngleRight, Asterisk, Bookmark, Clock, Comment, Eye, File, FormatIcon, Heart, Refresh, Send } from "../Icons";
import Negotiation from "./Negotiation";
import { initials } from "./HuntList";

const WINDOW_LABELS: Record<number, string> = { 7: "7 dias", 30: "30 dias", 90: "90 dias", 365: "12 meses" };
const TZ = "America/Sao_Paulo";
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
const banLabel = new Date(`${BETS_BAN_DATE}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: TZ });

/**
 * The prospect page. Order follows what closes a deal: engagement, delivery,
 * rhythm, publis, the bets check, then the posts, growth and the negotiation
 * panel. Every number on it is public and says so.
 */
export default function ProspectView({ prospect: p, windowDays }: { prospect: Prospect; windowDays: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const autoRan = useRef(false);

  function setWindow(d: string) {
    const next = new URLSearchParams(params.toString());
    if (Number(d) === HUNT_DEFAULT_WINDOW) next.delete("janela");
    else next.set("janela", d);
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  async function refresh(auto: boolean) {
    if (refreshing) return;
    setRefreshing(true);
    setNote(null);
    try {
      const res = await fetch(`/api/hunt/${p.id}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.status === "ok") router.refresh();
      else if (d.status === "busy") setTimeout(() => router.refresh(), 4000);
      else if (d.status === "cooldown") setNote(`Dá pra atualizar de novo em ${hoursLeft(d.retryInMs)}.`);
      else if (d.status === "error") {
        setNote(
          `Não deu para atualizar agora. Mostrando a versão de ${p.fetchedAt ? formatDate(p.fetchedAt) : "antes"}. ${errorCopy(
            d.code,
            { handle: p.handle, platform: p.platform }
          )}`
        );
      }
    } catch {
      setNote(`Não deu para atualizar agora. Mostrando a versão de ${p.fetchedAt ? formatDate(p.fetchedAt) : "antes"}.`);
    } finally {
      setRefreshing(false);
    }
  }

  // Fast, then fresh: a stale copy renders at once and revalidates behind a
  // quiet "atualizando…". Once per mount, so a failure doesn't loop.
  useEffect(() => {
    if (p.stale && !autoRan.current) {
      autoRan.current = true;
      refresh(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.stale]);

  const cooling = p.cooldownLeftMs > 0;

  return (
    <>
      <TopBar
        staff
        back={{ href: "/admin/hunt", label: "voltar ao hunt" }}
        identity={{
          name: p.name,
          handle: `${p.handle} · ${p.platform}`,
          avatarUrl: p.avatarUrl,
          stats: creatorStats({ following: p.following, postCount: p.mediaCount, followers: p.followers }),
        }}
      />

      <main className="shell">
        <div className="controls">
          <Seg
            label="Período"
            value={String(windowDays)}
            onChange={setWindow}
            items={WINDOWS.map((d) => ({ key: String(d), label: WINDOW_LABELS[d] }))}
          />
          <div className="controls-right">
            <Chip tone="dark">externo</Chip>
            <span className="fresh">
              <Clock size={13} />
              dados públicos · {p.sourceLabel} · {refreshing ? "atualizando…" : formatFreshness(p.fetchedAt)}
            </span>
            <button
              className="btn sm"
              onClick={() => refresh(false)}
              disabled={refreshing || cooling}
              title={cooling ? `Dá pra atualizar de novo em ${hoursLeft(p.cooldownLeftMs)}` : "Buscar os dados públicos de novo"}
            >
              <Refresh size={14} className={refreshing ? "spin" : undefined} />
              atualizar
            </button>
            <a className="btn sm" href={p.profileUrl} target="_blank" rel="noopener noreferrer">
              abrir no {p.platform}
            </a>
          </div>
        </div>

        <div className="hunt-source">
          {cooling && !refreshing && <Caption>dá pra atualizar de novo em {hoursLeft(p.cooldownLeftMs)}</Caption>}
          {note && (
            <div className="notice" role="status" aria-live="polite">
              {note}
            </div>
          )}
          {!note && p.lastError && p.lastErrorAt && p.fetchedAt && new Date(p.lastErrorAt) > new Date(p.fetchedAt) && (
            <Caption>
              A última tentativa de atualizar ({formatFreshness(p.lastErrorAt).replace("atualizado", "")}) falhou.
              Mostrando a versão de {formatDate(p.fetchedAt)}.
            </Caption>
          )}
          {p.linked && (
            <Caption>
              {p.linked.connected ? (
                <>
                  conectado como creator da 1043 ·{" "}
                  <Link href={`/admin/${p.linked.influencerId}?rede=${p.platform}`} className="link">
                    ver dados verificados
                  </Link>
                </>
              ) : (
                <>acesso de creator criado para {p.linked.name}, aguardando conexão da conta</>
              )}
            </Caption>
          )}
        </div>

        <div className="dash-top">
          <div style={{ minWidth: 0 }}>
            <Delivery p={p} />
            <Rhythm p={p} />
          </div>
          <Hero p={p} />
        </div>

        <Publis p={p} />
        <Attention p={p} />
        <Posts p={p} />
        <Growth p={p} />
        <Negotiation prospect={p} />

        <div className="foot-note">
          <span>1043 AG · hunt</span>
          <span>uso interno</span>
        </div>
      </main>
    </>
  );
}

function hoursLeft(ms: number): string {
  const h = Math.ceil(ms / 3_600_000);
  return h <= 1 ? "1 h" : `${h} h`;
}

/* ─────────────────── engajamento ─────────────────── */

function Hero({ p }: { p: Prospect }) {
  const isIg = p.platform === "instagram";
  const rate = p.engagement.rate;
  const has = p.window.posts > 0 && rate != null;
  const c = p.engagement.comparison;

  return (
    <aside className="hero">
      <h2 className="h2">engajamento</h2>
      <div className="hero-rate">
        {has ? (
          <>
            <span className="n">{formatRate(rate)}</span>
            <span className="u">%</span>
          </>
        ) : (
          <span className="n empty">{dash}</span>
        )}
      </div>
      <div className="hero-chip">
        <Chip>{isIg ? "er público" : "er"}</Chip>
        <Chip tone="dark">externo</Chip>
      </div>
      <div className="hero-note">
        <Asterisk size={15} />
        <span>
          {p.likesHidden
            ? "Este perfil oculta as curtidas; sem elas o ER não é calculado."
            : p.window.posts === 0
            ? `Nenhum post nos últimos ${p.window.days} dias.`
            : c
            ? c.allTiers
              ? `Creators da 1043 no ${p.platformLabel}, todas as faixas: ${formatRate(c.median)}% · ${c.count} ${
                  c.count === 1 ? "perfil" : "perfis"
                } (menos de 3 na faixa ${c.tier})`
              : `Creators da 1043 na faixa ${c.tier}: ${formatRate(c.median)}% · ${c.count} ${c.count === 1 ? "perfil" : "perfis"}`
            : "Sem creators conectados nessa rede para comparar."}
        </span>
      </div>
      <div className="hero-more">
        <Caption>
          {isIg
            ? `Curtidas + comentários ÷ seguidores, no post típico dos últimos ${p.window.days} dias. Salvos e envios são privados no Instagram, então este número fica abaixo do ER dos creators conectados.`
            : `Interações ÷ views no vídeo típico dos últimos ${p.window.days} dias. Mesma conta usada no roster.`}
        </Caption>
      </div>
    </aside>
  );
}

/* ─────────────────── entrega ─────────────────── */

function Delivery({ p }: { p: Prospect }) {
  const isIg = p.platform === "instagram";
  const d = p.delivery;
  const mv = d.mediaValue;

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <SectionHead title="entrega" />
      <div className="card">
        <div className="kpis">
          <div className="kpi">
            <span className="kpi-label">views típicas</span>
            {d.views == null ? (
              <span className="kpi-value empty">
                {p.window.posts === 0
                  ? "sem posts no período"
                  : isIg
                  ? `só ${d.withViews} ${d.withViews === 1 ? "reel" : "reels"} no período; precisa de 3`
                  : "sem views reportadas"}
              </span>
            ) : (
              <span className="kpi-value">{formatCount(d.views)}</span>
            )}
            <span className="kpi-foot">
              <Caption>{isIg ? "só Reels. A API oficial soma views orgânicas e pagas" : "por vídeo, mediana do período"}</Caption>
            </span>
          </div>

          <div className="kpi">
            <span className="kpi-label">taxa de views</span>
            {d.viewRate == null ? (
              <span className="kpi-value empty">{d.views == null ? "depende das views típicas" : "sem seguidores reportados"}</span>
            ) : (
              <span className="kpi-value">
                {formatRate(d.viewRate)}
                <span className="u">%</span>
              </span>
            )}
            <span className="kpi-foot">
              <Caption>views típicas ÷ seguidores</Caption>
            </span>
          </div>

          <div className="kpi">
            <span className="kpi-label">valor / post</span>
            {mv ? (
              <span className="kpi-value" style={{ fontSize: 26 }}>
                {mv.currency} {formatNumber(mv.low)} a {formatNumber(mv.high)}
              </span>
            ) : (
              <span className="kpi-value empty">depende das views típicas</span>
            )}
            <span className="kpi-foot">
              <Caption>views típicas a um CPM de R$ 15 a 35. Piso de mídia, não tabela de preço</Caption>
            </span>
          </div>

          {isIg ? (
            <div className="kpi">
              <span className="kpi-label">alcance · salvos</span>
              <span className="kpi-value empty">só com a conta conectada</span>
              <span className="kpi-foot">
                <Caption>privados no Instagram. Veja "dados verificados" abaixo</Caption>
              </span>
            </div>
          ) : (
            <div className="kpi">
              <span className="kpi-label">compartilhamentos · salvos</span>
              <span className="kpi-value">
                {formatCount(d.shares)}
                <span className="u">·</span>
                {formatCount(d.collects)}
              </span>
              <span className="kpi-foot">
                <Caption>típicos por vídeo. Salvos públicos ficam fora do er, como no roster</Caption>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── ritmo ─────────────────── */

function Rhythm({ p }: { p: Prospect }) {
  const r = p.rhythm;
  const cells = [
    { key: "week", v: r.perWeek == null ? dash : formatRate(r.perWeek, 1), l: "posts por semana" },
    { key: "gap", v: r.medianGap == null ? dash : formatRate(r.medianGap, 1), l: "dias entre posts, mediana" },
    { key: "max", v: r.maxGap == null ? dash : String(Math.round(r.maxGap)), l: "dias na maior pausa" },
    { key: "last", v: r.lastPostAt ? shortDate(r.lastPostAt) : dash, l: "último post" },
  ];
  return (
    <>
      <div className="sub-head">
        <h3 className="h3">ritmo</h3>
        <Caption>
          {p.window.posts} {p.window.posts === 1 ? "post" : "posts"} nos últimos {p.window.days} dias
        </Caption>
      </div>
      <div className="card tight">
        <div className="freq">
          {cells.map((x) => (
            <div key={x.key}>
              <div className="v">{x.v}</div>
              <div className="l">{x.l}</div>
            </div>
          ))}
        </div>
        {r.formats && r.formats.length > 0 && (
          <div className="support" style={{ padding: "18px 0 0" }}>
            {r.formats.map((f) => (
              <span key={f.key}>
                <FormatIcon format={f.key} size={12} />
                {f.label} <b>{Math.round(f.pct)}%</b>
              </span>
            ))}
          </div>
        )}
      </div>
      {r.cappedSince && (
        <Caption style={{ marginTop: 10, paddingLeft: 10 }}>
          A fonte devolve no máximo 60 posts, publicados a partir de <b>{shortDate(r.cappedSince)}</b>. O período está
          coberto só em parte; o ritmo vale para esse trecho.
        </Caption>
      )}
    </>
  );
}

/* ─────────────────── publis ─────────────────── */

function Publis({ p }: { p: Prospect }) {
  const u = p.publis;
  const isIg = p.platform === "instagram";
  return (
    <section className="section">
      <SectionHead title="publis" />
      <div className="card">
        <div className="freq" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, max-content))", gap: "20px 48px" }}>
          <div>
            <div className="v">{u.count}</div>
            <div className="l">
              {u.count === 1 ? "publi" : "publis"} no período
              {u.share != null && p.window.posts > 0 ? ` · ${Math.round(u.share)}% dos posts` : ""}
            </div>
          </div>
          {u.erPaid != null && u.erOrganic != null ? (
            <>
              <div>
                <div className="v">{formatRate(u.erPaid)}%</div>
                <div className="l">{isIg ? "er público" : "er"} das publis, mediana</div>
              </div>
              <div>
                <div className="v">{formatRate(u.erOrganic)}%</div>
                <div className="l">{isIg ? "er público" : "er"} dos orgânicos, mediana</div>
              </div>
            </>
          ) : (
            <div>
              <div className="v" style={{ color: "var(--ink-300)" }}>{dash}</div>
              <div className="l">
                {p.likesHidden
                  ? "sem er: curtidas ocultas"
                  : `er publi × orgânico só com 3 de cada (${u.count} publi, ${p.window.posts - u.count} orgânicos)`}
              </div>
            </div>
          )}
        </div>

        {u.posts.length > 0 && (
          <div style={{ marginTop: 20, display: "grid", gap: 8 }}>
            {u.posts
              .slice()
              .sort((a, b) => Date.parse(b.postedAt ?? "") - Date.parse(a.postedAt ?? ""))
              .map((x) => (
                <div key={x.id} className="hunt-line">
                  <span className="caption" style={{ whiteSpace: "nowrap" }}>{x.postedAt ? shortDate(x.postedAt) : dash}</span>
                  <Chip>{x.formatLabel.toLowerCase()}</Chip>
                  <span className="hunt-line-cap" title={x.caption}>{x.caption || x.formatLabel}</span>
                  {x.er != null && (
                    <span className="post-er">
                      {isIg ? "er público" : "er"} <b>{formatRate(x.er, 2)}%</b>
                    </span>
                  )}
                  {x.permalink && (
                    <a href={x.permalink} target="_blank" rel="noopener noreferrer" className="link caption">
                      abrir
                    </a>
                  )}
                </div>
              ))}
          </div>
        )}
        <Caption style={{ marginTop: 14 }}>
          Publi = hashtag na legenda (#publi, #publicidade, #ad, #ads, #paid, #parceria, #publipost, #recebido)
          {isIg ? "." : " ou marcação de conteúdo pago do TikTok."} Sem marca identificada: as legendas chegam sem o @.
        </Caption>
      </div>
    </section>
  );
}

/* ─────────────────── atenção ─────────────────── */

function Attention({ p }: { p: Prospect }) {
  const hits = p.bets.hits;
  const WHERE: Record<string, string> = { bio: "bio", link: "link da bio", post: "post" };
  return (
    <section className="section">
      <SectionHead title="atenção" right={hits.length > 0 ? <Chip tone="dark">sinais de apostas · {hits.length}</Chip> : undefined} />
      {hits.length === 0 ? (
        <Caption style={{ paddingLeft: 10 }}>
          Nenhum sinal de apostas na bio e nos últimos {p.bets.scannedPosts} posts.
        </Caption>
      ) : (
        <div className="card">
          <div style={{ display: "grid", gap: 8 }}>
            {hits.map((h, i) => (
              <div key={i} className="hunt-line">
                <span className="caption" style={{ whiteSpace: "nowrap" }}>{h.date ? shortDate(h.date) : WHERE[h.where]}</span>
                <Chip tone={h.level === "alto" ? "dark" : undefined}>{h.level === "alto" ? "alto risco" : "anterior à MP"}</Chip>
                <span className="hunt-line-cap">
                  {WHERE[h.where]} · termo "{h.term}"
                  {h.level === "anterior" ? " · confira se o operador era autorizado" : ""}
                </span>
                {h.href && (
                  <a href={h.href} target="_blank" rel="noopener noreferrer" className="link caption">
                    abrir
                  </a>
                )}
              </div>
            ))}
          </div>
          <Caption style={{ marginTop: 14 }}>
            Desde {banLabel} a MP 1.394 proíbe publicidade de apostas no Brasil. Confira antes de propor qualquer job. Uma MP é
            provisória: o Congresso tem 60 + 60 dias para convertê-la, e há contestação no STF.
          </Caption>
        </div>
      )}
    </section>
  );
}

/* ─────────────────── posts ─────────────────── */

function Posts({ p }: { p: Prospect }) {
  return (
    <section className="section">
      <SectionHead title="posts" />
      {p.posts.length === 0 ? (
        <Caption style={{ paddingLeft: 10 }}>Nenhum post no período.</Caption>
      ) : (
        <>
          <div className="post-grid">
            {p.posts.map((x) => (
              <HuntPostTile key={x.id} post={x} platform={p.platform} />
            ))}
          </div>
          <Caption style={{ marginTop: 22, paddingLeft: 10, maxWidth: 820 }}>
            Os {p.posts.length} mais recentes do período, do mais novo para o mais antigo. Miniaturas vêm da rede e podem
            expirar; clique para abrir o post.
          </Caption>
        </>
      )}
    </section>
  );
}

/**
 * The post tile, in the hunt's version: the image goes through a plain img
 * with no referrer (CDN links expire and reject hotlinks), an ER badge that
 * is marked público on Instagram, and a publi chip from either signal.
 */
function HuntPostTile({ post, platform }: { post: ProspectPost; platform: "instagram" | "tiktok" }) {
  const isIg = platform === "instagram";
  const Wrapper = post.permalink ? "a" : "div";
  const [broken, setBroken] = useState(false);
  return (
    <Wrapper
      className="post"
      {...(post.permalink ? { href: post.permalink, target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <div className={`post-media ${isIg ? "ig" : "tt"}`}>
        {post.thumbnailUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <div className="post-hatch">
            <FormatIcon format={post.format} size={26} />
          </div>
        )}
        <span className="post-chip">
          <AngleRight size={8} />
          {post.formatLabel}
        </span>
        {post.paid && <span className="post-flag paid" style={{ top: 25 }}>publi</span>}
        <span className="post-stats">
          {post.views != null && (
            <span className="post-stat">
              <Eye size={12} />
              {formatCount(post.views)}
            </span>
          )}
          <span className="post-stat">
            <Heart size={12} />
            {formatCount(post.likes)}
          </span>
          <span className="post-stat">
            <Comment size={12} />
            {formatCount(post.comments)}
          </span>
          {post.shares != null && (
            <span className="post-stat">
              <Send size={12} />
              {formatCount(post.shares)}
            </span>
          )}
          {post.collects != null && (
            <span className="post-stat">
              <Bookmark size={12} />
              {formatCount(post.collects)}
            </span>
          )}
        </span>
      </div>
      <div className="post-foot">
        <span className="post-cap" title={post.caption}>
          <File size={12} />
          <span>{post.postedAt ? `${shortDate(post.postedAt)} · ` : ""}{post.caption || post.formatLabel}</span>
        </span>
        {post.er != null && (
          <span className="post-er">
            {isIg ? "público" : "ER"} <b>{formatRate(post.er, 2)}%</b>
          </span>
        )}
      </div>
    </Wrapper>
  );
}

/* ─────────────────── crescimento ─────────────────── */

function Growth({ p }: { p: Prospect }) {
  const g = p.growth;
  return (
    <section className="section">
      <SectionHead title="crescimento" />
      <div className="card">
        {g.snapshots <= 1 || g.firstSeenAt == null ? (
          <Caption>O histórico começa nesta busca. Buscando de novo nos próximos dias, a evolução aparece aqui.</Caption>
        ) : (
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="freq" style={{ gridTemplateColumns: "repeat(2, auto)", gap: 48, justifyContent: "start" }}>
              <div>
                <div className="v">{g.delta == null ? dash : `${g.delta > 0 ? "+" : ""}${formatNumber(g.delta)}`}</div>
                <div className="l">seguidores desde {shortDate(g.firstSeenAt)}</div>
              </div>
              <div>
                <div className="v">{g.snapshots}</div>
                <div className="l">buscas registradas</div>
              </div>
            </div>
            {g.series.length >= 3 ? (
              <div style={{ flex: 1, minWidth: 180, maxWidth: 320 }}>
                <Sparkline data={g.series} w={320} h={48} label="seguidores por busca" />
                <Caption style={{ marginTop: 6 }}>um ponto por busca, da primeira à mais recente</Caption>
              </div>
            ) : (
              <Caption style={{ maxWidth: 320 }}>A curva aparece a partir da terceira busca.</Caption>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export { initials };
