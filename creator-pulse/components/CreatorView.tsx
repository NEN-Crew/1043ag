"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CreatorReport } from "@/lib/report";
import type { Audience, PlatformView, Post } from "@/lib/metrics";
import { WINDOWS, isPaid } from "@/lib/metrics";
import { cadenceOf } from "@/lib/insights";
import { dash, formatCount, formatFreshness, formatNumber, formatRate } from "@/lib/format";
import { Bar, Caption, Chip, DeltaTag, Donut, SectionHead, Seg, Sparkline, VerdictChip } from "./ui";
import TopBar, { creatorStats } from "./TopBar";
import Chart from "./Chart";
import PeriodChart, { type PeriodMetric } from "./PeriodChart";
import {
  AngleRight,
  Asterisk,
  Bookmark,
  ChevronDown,
  Clock,
  Comment,
  Eye,
  File,
  Folder,
  FormatIcon,
  Heart,
  Info,
  Insights,
  KindIcon,
  Refresh,
  Send,
} from "./Icons";

type Props = {
  report: CreatorReport;
  /** "self" is the creator looking at their own numbers; "agency" is staff. */
  variant: "self" | "agency";
  windowDays: number;
  /** Notices from the page (a network just connected, a failed connection). */
  notices?: React.ReactNode;
  /** Rendered after the report, before the footer (the connect-a-network block). */
  after?: React.ReactNode;
};

const WINDOW_LABELS: Record<number, string> = {
  7: "7 dias",
  30: "30 dias",
  90: "90 dias",
  365: "12 meses",
};

// Dates are read in Brasília time. The server renders in UTC, so without a
// fixed zone a post at 22h would print one day on the server and another in
// the browser, and React would throw the server's markup away.
const TZ = "America/Sao_Paulo";

/** dd/mm — enough to check a window against a calendar. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
}

/** A date range; the year appears only when the ends fall in different ones. */
function rangeLabel(from: string, to: string): string {
  const a = new Date(from);
  const b = new Date(to);
  const withYear = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: TZ });
  return a.getFullYear() === b.getFullYear()
    ? `${shortDate(from)} a ${shortDate(to)}`
    : `${withYear(a)} a ${withYear(b)}`;
}

export default function CreatorView({ report, variant, windowDays, notices, after }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const wanted = params.get("rede");
  const [active, setActive] = useState<"instagram" | "tiktok">(
    (report.platforms.find((p) => p.platform === wanted)?.platform ?? report.platforms[0]?.platform ?? "instagram") as
      | "instagram"
      | "tiktok"
  );
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const view = report.platforms.find((p) => p.platform === active) ?? report.platforms[0] ?? null;
  const staff = variant === "agency";
  const base = staff ? `/admin/${report.influencer.id}` : "/me";
  const insightsHref = view ? `${base}/insights?rede=${view.platform}` : `${base}/insights`;
  const infoHref = view ? `${base}/info?rede=${view.platform}` : `${base}/info`;

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value == null) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  function selectNetwork(p: string) {
    setActive(p as "instagram" | "tiktok");
    setParam("rede", p);
  }

  function fireToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/refresh/${report.influencer.id}`, { method: "POST" });
      if (res.ok) {
        router.refresh();
        fireToast("Números atualizados");
      } else if (res.status === 429) {
        const d = await res.json().catch(() => ({}));
        const hours = Math.max(1, Math.ceil((d.retryInMs ?? 0) / 3600000));
        fireToast(`Atualizado há pouco · tente de novo em ${hours}h`);
      } else {
        fireToast("Falha ao atualizar");
      }
    } catch {
      fireToast("Falha ao atualizar");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      <TopBar
        staff={staff}
        back={staff ? { href: "/admin", label: "voltar ao ranking" } : undefined}
        identity={{
          name: report.influencer.name,
          handle: view?.handle,
          avatarUrl: view?.avatarUrl ?? report.avatarUrl,
          stats: creatorStats(view),
        }}
      />

      <main className="shell">
        {notices}

        <div className="controls">
          <Seg
            label="Período"
            value={String(windowDays)}
            onChange={(d) => setParam("janela", d === "30" ? null : d)}
            items={WINDOWS.map((d) => ({ key: String(d), label: WINDOW_LABELS[d] }))}
          />
          <div className="controls-right">
            {view && (
              <span className="fresh">
                <Clock size={13} />
                {refreshing ? "atualizando…" : formatFreshness(view.updatedAt)}
              </span>
            )}
            {view && (
              <button
                className="btn btn-icon sm"
                onClick={refresh}
                disabled={refreshing}
                aria-label="Atualizar números"
                title={variant === "self" ? "Atualizar (1x a cada 12h)" : "Atualizar agora"}
              >
                <Refresh size={15} className={refreshing ? "spin" : undefined} />
              </button>
            )}
            {view && (
              <a className="btn sm" href={insightsHref}>
                <Insights size={14} />
                insights
              </a>
            )}
            {report.platforms.length > 0 && (
              <Seg
                label="Rede"
                cobalt
                value={active}
                onChange={selectNetwork}
                items={report.platforms.map((p) => ({ key: p.platform, label: p.label.toLowerCase() }))}
              />
            )}
          </div>
        </div>

        {view ? (
          <>
            <div className="dash-top">
              <div style={{ minWidth: 0 }}>
                <ReachGrowth view={view} />
                <PostSum view={view} />
                {view.window.posts === 0 ? <EmptyWindow view={view} /> : <Frequency view={view} />}
              </div>
              <Hero view={view} infoHref={infoHref} />
            </div>

            {view.window.posts > 0 && <Performance view={view} />}
            <Content view={view} />
            <AudienceSection audience={report.audience} platform={view.platform} />
            <History view={view} />
          </>
        ) : (
          <div className="notice" style={{ marginTop: 8 }}>
            <span className="micro">nenhuma rede conectada</span>
            Conecte o Instagram ou o TikTok para o relatório aparecer.
          </div>
        )}

        {after}

        <div className="dash-foot">
          <p className="faq">
            alguma dúvida?
            <br />
            leia nossa <a href={infoHref}>faq.</a>
          </p>
          <button className="dl no-print" onClick={() => window.print()} title="Salvar este relatório em PDF">
            <span className="dl-box">
              <Folder size={24} />
            </span>
            <span className="dl-label">
              baixar
              <br />
              relatório
            </span>
          </button>
        </div>
        <div className="foot-note">
          <span>1043 AG · creator performance</span>
          <span>{staff ? report.influencer.email : "fim do relatório"}</span>
        </div>
      </main>

      {toast && (
        <div role="status" aria-live="polite" className="toast">
          <i />
          {toast}
        </div>
      )}
    </>
  );
}

/* ─────────────────── alcance & crescimento ─────────────────── */

function ReachGrowth({ view }: { view: PlatformView }) {
  const by = (key: string) => view.summary.find((m) => m.key === key);
  const followers = by("followers");
  const growth = by("growth");
  const score = by("score");
  const reach = by("reach");

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <SectionHead title="alcance & crescimento" />
      <div className="card">
        <div className="kpis">
          <div className="kpi">
            <span className="kpi-label">seguidores</span>
            <span className="kpi-value">{formatCount(followers?.value)}</span>
            <span className="kpi-foot">
              <DeltaTag delta={followers?.delta} suffix=" em 30 dias" />
              {followers?.trend && followers.trend.length > 2 && (
                <Sparkline data={followers.trend.map((p) => p.value)} w={110} h={20} color="var(--ink-300)" />
              )}
            </span>
          </div>

          <div className="kpi">
            <span className="kpi-label">crescimento</span>
            {growth?.value == null ? (
              <span className="kpi-value empty">ainda sem histórico para comparar</span>
            ) : (
              <span className="kpi-value">
                {formatRate(growth.value)}
                <span className="u">%</span>
              </span>
            )}
            <span className="kpi-foot">{growth?.value != null && <Caption>seguidores em 30 dias</Caption>}</span>
          </div>

          <div className="kpi">
            <span className="kpi-label">
              score <VerdictChip verdict={score?.verdict} />
            </span>
            <span className="kpi-value">
              {score?.value == null ? dash : formatRate(score.value, 0)}
              <span className="u">/100</span>
            </span>
            <span className="kpi-foot">
              <Caption>engajamento · alcance · impacto · consistência</Caption>
            </span>
          </div>

          <div className="kpi">
            <span className="kpi-label">
              {reach?.label.toLowerCase() ?? "alcance médio"} <VerdictChip verdict={reach?.verdict} />
            </span>
            <span className="kpi-value">{formatCount(reach?.value)}</span>
            <span className="kpi-foot">
              <Caption>por post, mediana do período</Caption>
            </span>
          </div>
        </div>
      </div>
      {view.caveat && (
        <Caption style={{ marginTop: 10, paddingLeft: 10 }}>{view.caveat}</Caption>
      )}
    </section>
  );
}

/* ─────────────────── soma das postagens ─────────────────── */

function PostSum({ view }: { view: PlatformView }) {
  const e = view.engagement;
  if (view.window.posts === 0) return null;

  return (
    <>
      <div className="sub-head">
        <h3 className="h3">soma das postagens desse período</h3>
        <Caption>
          {view.window.posts} {view.window.posts === 1 ? "post" : "posts"} · {rangeLabel(view.window.from, view.window.to)}
        </Caption>
      </div>
      <div className="sum-row">
        <div className="card tight">
          <div className="sum">
            {e.breakdown.map((b) => (
              <div className="sum-cell" key={b.kind}>
                <span className="l">
                  <KindIcon kind={b.kind} size={13} />
                  {b.label.toLowerCase()}
                </span>
                <span className="v">{formatCount(b.count)}</span>
              </div>
            ))}
          </div>
        </div>
        {e.byReach != null && (
          <div className="aside-stat">
            <span className="v">{formatRate(e.byReach)}%</span>
            <span className="t">
              de quem vê,
              <br />
              reage aos seus posts.
            </span>
          </div>
        )}
      </div>
      <Caption style={{ marginTop: 10, paddingLeft: 10 }}>
        Soma dos {view.window.posts} posts do período. O ER usa a mediana por post, não a soma.
        {view.lifetimeLikes != null && (
          <>
            {" "}Total da conta no perfil do {view.label}: <b>{formatCount(view.lifetimeLikes)}</b> curtidas.
          </>
        )}
      </Caption>
    </>
  );
}

/* ─────────────────── frequência + apoio ─────────────────── */

function Frequency({ view }: { view: PlatformView }) {
  const c = useMemo(() => cadenceOf(view), [view]);
  const e = view.engagement;
  const cells = [
    { key: "week", v: c.perWeek == null ? dash : formatRate(c.perWeek, 1), l: "posts por semana" },
    { key: "gap", v: c.medianGap == null ? dash : formatRate(c.medianGap, 1), l: "dias entre posts, mediana" },
    { key: "max", v: c.maxGap == null ? dash : String(Math.round(c.maxGap)), l: "dias no maior intervalo" },
    { key: "last", v: c.lastPostAt ? shortDate(c.lastPostAt) : dash, l: "último post" },
  ];

  return (
    <>
      <div className="sub-head">
        <h3 className="h3">frequência</h3>
        <Caption>um intervalo longo é o motivo mais comum de o engajamento mudar</Caption>
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
      </div>
      <div className="support" style={{ marginTop: 14 }}>
        <span>
          <Comment size={12} />
          taxa de comentários <b>{e.commentsRate == null ? dash : `${formatRate(e.commentsRate, 2)}%`}</b>
        </span>
        {e.likesPerComment != null && (
          <span>
            <Heart size={12} />
            <b>1</b> comentário a cada <b>{formatNumber(e.likesPerComment)}</b> curtidas
          </span>
        )}
        {view.sendsPerReach != null && (
          <span>
            <Send size={12} />
            salvos + enviados / alcance <b>{formatRate(view.sendsPerReach)}%</b>
          </span>
        )}
      </div>
    </>
  );
}

/** Nothing published in the window — say so, and say when they last did. */
function EmptyWindow({ view }: { view: PlatformView }) {
  return (
    <div className="notice warn" style={{ marginTop: 26 }}>
      <span className="micro">nenhum post no período</span>
      Sem posts entre {rangeLabel(view.window.from, view.window.to)}.{" "}
      {view.window.lastPostAt
        ? `Último post: ${new Date(view.window.lastPostAt).toLocaleDateString("pt-BR", { timeZone: TZ })}.`
        : "Nenhum post registrado."}{" "}
      Amplie o período para ver dados.
    </div>
  );
}

/* ─────────────────── engajamento (hero) ─────────────────── */

function Hero({ view, infoHref }: { view: PlatformView; infoHref: string }) {
  const e = view.engagement;
  const has = view.window.posts > 0 && e.rate != null;

  return (
    <aside className="hero">
      <h2 className="h2">engajamento</h2>
      <div className="hero-rate">
        {has ? (
          <>
            <span className="n">{formatRate(e.rate)}</span>
            <span className="u">%</span>
          </>
        ) : (
          <span className="n empty">{dash}</span>
        )}
      </div>
      <div className="hero-chip">
        <DeltaTag delta={e.delta} suffix=" vs. mês ant." />
        <VerdictChip verdict={has ? e.verdict : null} />
      </div>
      <div className="hero-note">
        <Asterisk size={15} />
        <span>{e.verdictNote}</span>
      </div>
      <div className="hero-more">
        <Caption>
          {view.platform === "instagram"
            ? "curtidas + comentários + salvos + enviados ÷ seguidores, na mediana dos posts."
            : "curtidas + comentários + compartilhamentos ÷ views, na mediana dos vídeos."}
        </Caption>
        <a className="link caption" href={`${infoHref}#score`} style={{ color: "var(--cobalt)" }}>
          como o score é montado →
        </a>
      </div>
    </aside>
  );
}

/* ─────────────────── desempenho (charts) ─────────────────── */

function Performance({ view }: { view: PlatformView }) {
  const [metric, setMetric] = useState<PeriodMetric>("er");
  const e = view.engagement;
  const s = view.periods;
  const reachLabel = view.platform === "instagram" ? "Alcance" : "Views";
  const unitLabel = s?.unit === "week" ? "semana a semana" : "mês a mês";
  const since = s?.cappedSince
    ? new Date(s.cappedSince).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : null;

  return (
    <section className="section">
      <SectionHead title="desempenho" />

      <div className="card">
        <div className="chart-head">
          <div>
            <span className="label-lg">por período{s ? ` · ${unitLabel}` : ""}</span>
            <Caption>
              {metric === "er"
                ? "Cada coluna é o ER dos posts publicados naquele período, na mesma conta do número grande acima."
                : metric === "reach"
                ? `${reachLabel} de um post típico de cada período, pela mediana.`
                : "Reações de um post típico de cada período, pela mediana: curtidas, comentários e envios."}
            </Caption>
          </div>
          {s && (
            <Seg
              small
              label="Métrica por período"
              value={metric}
              onChange={(k) => setMetric(k as PeriodMetric)}
              items={[
                { key: "er", label: "ER" },
                { key: "reach", label: reachLabel },
                { key: "interactions", label: "Reações" },
              ]}
            />
          )}
        </div>
        {s ? (
          <>
            <PeriodChart series={s} metric={metric} reachLabel={reachLabel} />
            {since && (
              <div className="chart-note">
                <Info size={13} />
                <Caption>
                  Cobre os {view.content.all.length} posts mais recentes, publicados a partir de <b>{since}</b>. Períodos
                  anteriores não estão no relatório, não é que não houve posts.
                </Caption>
              </div>
            )}
          </>
        ) : (
          <Caption>Sete dias não dão períodos para comparar. Amplie para 30 dias ou mais.</Caption>
        )}
      </div>

      <div className="card chart-card">
        <div className="chart-head">
          <div>
            <span className="label-lg">dia a dia</span>
            <Caption>Taxa de engajamento da conta em cada dia, com os dias de publicação marcados.</Caption>
          </div>
        </div>
        {e.trend.length >= 2 ? (
          <>
            <Chart
              points={e.trend}
              label="taxa de engajamento"
              format={(n) => `${formatRate(n)}%`}
              formatDetail={(n) => `${formatRate(n, 2)}%`}
              markers={view.published}
              minSpan={1}
            />
            <CollectionNote trend={e.trend} windowDays={view.window.days} />
          </>
        ) : (
          <Caption>
            {e.trend.length === 1
              ? "Um dia registrado até agora. A curva começa a desenhar amanhã."
              : "A curva aparece assim que houver dois dias registrados."}
          </Caption>
        )}
      </div>
    </section>
  );
}

/** The chart can only ever start where our collection started; it says which. */
function CollectionNote({ trend, windowDays }: { trend: { at: string }[]; windowDays: number }) {
  if (!trend.length) return null;
  const since = new Date(trend[0].at);
  const covered = (Date.now() - since.getTime()) / 864e5;
  const short = covered < windowDays * 0.8;
  const label = since.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className={`chart-note${short ? " warn" : ""}`}>
      <Info size={13} />
      <Caption style={short ? { color: "var(--ink)" } : undefined}>
        {short ? (
          <>
            <b>Histórico disponível a partir de {label}.</b> Sem dados anteriores a essa data. A curva se estende a cada dia
            registrado.
          </>
        ) : (
          <>Um ponto por dia desde {label}. Passe o mouse ou use as setas para ver cada dia.</>
        )}
      </Caption>
    </div>
  );
}

/* ─────────────────── conteúdo ─────────────────── */

function Content({ view }: { view: PlatformView }) {
  const c = view.content;
  const [filter, setFilter] = useState<"all" | "organic" | "paid">("all");

  const shown = filter === "paid" ? c.paid : filter === "organic" ? c.organic : c.all;
  const filters = [
    { key: "all", label: <>todos&nbsp;•&nbsp;{c.all.length}</> },
    { key: "organic", label: <>orgânicos&nbsp;•&nbsp;{c.organic.length}</>, disabled: c.organic.length === 0 },
    { key: "paid", label: <>publis&nbsp;•&nbsp;{c.paid.length}</>, disabled: c.paid.length === 0 },
  ];

  return (
    <section className="section">
      <SectionHead title="conteúdo" />
      {c.all.length > 0 && (
        <div style={{ margin: "0 0 26px" }}>
          <Seg label="Filtrar posts" value={filter} onChange={(k) => setFilter(k as typeof filter)} items={filters} />
        </div>
      )}

      {c.all.length === 0 ? (
        <Caption style={{ paddingLeft: 10 }}>Nenhum post com métricas nesse período.</Caption>
      ) : shown.length === 0 ? (
        <Caption style={{ paddingLeft: 10 }}>Nenhum post desse tipo no período.</Caption>
      ) : (
        <div className="post-grid">
          {shown.map((p) => (
            <PostTile key={p.id} post={p} platform={view.platform} />
          ))}
        </div>
      )}

      {c.all.length > 0 && (
        <Caption style={{ marginTop: 22, paddingLeft: 10, maxWidth: 820 }}>
          {view.platform === "instagram"
            ? "ER do post = (curtidas + comentários + salvos + enviados) ÷ seguidores."
            : "ER do post = (curtidas + comentários + compartilhamentos) ÷ views."}{" "}
          Ordenados por engajamento, do maior para o menor.{" "}
          {c.confidence === "none" ? (
            <>
              {c.all.length} {c.all.length === 1 ? "post" : "posts"} no período.
            </>
          ) : c.confidence === "weak" ? (
            <>{c.all.length} posts no período. Marcações exigem desvio maior nesse volume.</>
          ) : (
            <>
              Viral: entrega acima de 5x a base de seguidores. Acima da média: 1 desvio acima da mediana do perfil. Abaixo
              da média: 2 desvios abaixo.
            </>
          )}
          {c.paid.length > 0 && filter !== "organic" && (
            <>
              {" "}Publi identificada por hashtag na legenda: #publi, #publicidade, #ad, #ads, #paid, #parceria, #publipost,
              #recebido. Sem a hashtag, o post consta como orgânico.
            </>
          )}
        </Caption>
      )}
    </section>
  );
}

function PostTile({ post, platform }: { post: Post; platform: "instagram" | "tiktok" }) {
  const paid = isPaid(post);
  const Wrapper = post.permalink ? "a" : "div";
  const flags: { key: string; cls: string; text: string }[] = [];
  if (paid) flags.push({ key: "paid", cls: "paid", text: "publi" });
  if (post.standout)
    flags.push({
      key: "standout",
      cls: post.standout,
      text:
        post.standout === "viral"
          ? post.reachMultiple && post.reachMultiple >= 5
            ? `viral · ${Math.round(post.reachMultiple)}× a base`
            : "viral"
          : post.standout === "high"
          ? "acima da média"
          : "abaixo da média",
    });

  return (
    <Wrapper
      className="post"
      {...(post.permalink ? { href: post.permalink, target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <div className={`post-media ${platform === "instagram" ? "ig" : "tt"}`}>
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <div className="post-hatch">
            <FormatIcon format={post.format} size={26} />
          </div>
        )}
        <span className="post-chip">
          <AngleRight size={8} />
          {post.formatLabel}
        </span>
        {flags.map((f, i) => (
          <span key={f.key} className={`post-flag ${f.cls}`} style={{ top: 25 + i * 22 }}>
            {f.text}
          </span>
        ))}
        <span className="post-stats">
          {platform === "tiktok" && post.views != null && (
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
          {platform === "instagram" && post.saves != null && (
            <span className="post-stat">
              <Bookmark size={12} />
              {formatCount(post.saves)}
            </span>
          )}
          {post.shares != null && (
            <span className="post-stat">
              <Send size={12} />
              {formatCount(post.shares)}
            </span>
          )}
        </span>
      </div>
      <div className="post-foot">
        <span className="post-cap" title={post.caption}>
          <File size={12} />
          <span>{post.caption || post.formatLabel}</span>
        </span>
        {post.er != null && (
          <span className={`post-er${post.standout === "low" ? " low" : ""}`}>
            ER <b>{formatRate(post.er, 2)}%</b>
          </span>
        )}
      </div>
    </Wrapper>
  );
}

/* ─────────────────── audiência ─────────────────── */

/**
 * Instagram reports seven age brackets; the design draws four. Everything
 * from 45 up folds into "45+", and slices under half a percent are dropped.
 */
function ageGroups(age: { label: string; pct: number }[]) {
  const out: { label: string; pct: number }[] = [];
  for (const a of age) {
    const from = parseInt(a.label, 10);
    if (Number.isFinite(from) && from >= 45) {
      const last = out[out.length - 1];
      if (last && last.label === "45+") last.pct += a.pct;
      else out.push({ label: "45+", pct: a.pct });
    } else out.push({ label: a.label, pct: a.pct });
  }
  return out.filter((s) => s.pct >= 0.5);
}

/** Top N plus an "Outros" row for the rest, as in the design. */
function topWithOthers(rows: { name: string; pct: number }[], n: number) {
  const top = rows.slice(0, n);
  const rest = rows.slice(n).reduce((a, r) => a + r.pct, 0);
  return rest >= 0.5 ? [...top, { name: "Outros", pct: rest }] : top;
}

function AudienceSection({ audience, platform }: { audience: Audience | null; platform: "instagram" | "tiktok" }) {
  const blocks: { key: string; title: string; body: React.ReactNode; center?: boolean }[] = [];

  if (audience) {
    blocks.push({
      key: "age",
      title: "idade",
      body:
        audience.age.length > 0 ? (
          <Donut slices={ageGroups(audience.age)} />
        ) : (
          <span className="aud-empty">Sem faixa etária reportada.</span>
        ),
    });
    blocks.push({
      key: "gender",
      title: "gênero",
      center: true,
      body: audience.gender ? (
        <>
          <div className="gender">
            <div className="v">{Math.round(audience.gender.female)}%</div>
            <div className="l">feminino</div>
          </div>
          <div className="gender">
            <div className="v">{Math.round(audience.gender.male)}%</div>
            <div className="l">masculino</div>
          </div>
          {audience.gender.other != null && audience.gender.other >= 0.5 && (
            <div className="gender">
              <div className="v">{Math.round(audience.gender.other)}%</div>
              <div className="l">outros</div>
            </div>
          )}
        </>
      ) : (
        <span className="aud-empty">Sem gênero reportado.</span>
      ),
    });
    blocks.push({
      key: "cities",
      title: "localização",
      body:
        audience.cities.length > 0 ? (
          <div className="bars">
            {topWithOthers(audience.cities, 4).map((c) => (
              <Bar key={c.name} label={c.name} pct={c.pct} />
            ))}
          </div>
        ) : (
          <span className="aud-empty">As cidades aparecem na próxima atualização automática do Instagram.</span>
        ),
    });
    blocks.push({
      key: "countries",
      title: "países",
      body:
        audience.geography.length > 0 ? (
          <div className="bars">
            {topWithOthers(audience.geography, 3).map((c) => (
              <Bar key={c.name} label={c.name} pct={c.pct} />
            ))}
          </div>
        ) : (
          <span className="aud-empty">Sem país reportado.</span>
        ),
    });
  }

  return (
    <section className="section">
      <SectionHead title="audiência" />
      {!audience ? (
        <div className="notice">
          <span className="micro">{platform === "tiktok" ? "instagram apenas" : "sem dados ainda"}</span>
          {platform === "tiktok"
            ? "A API do TikTok não expõe dados demográficos da audiência. Idade, gênero e localização vêm só do Instagram."
            : "O Instagram só reporta dados demográficos para contas com mais de 100 seguidores. Eles aparecem na próxima atualização."}
        </div>
      ) : (
        <>
          <div className="aud-grid">
            {blocks.map((b) => (
              <div className="aud-block" key={b.key}>
                <h3 className="h3">{b.title}</h3>
                <div className={`aud-card${b.center ? " center" : ""}`}>{b.body}</div>
              </div>
            ))}
          </div>
          <Caption style={{ marginTop: 14, paddingLeft: 10 }}>
            Dados dos seguidores no Instagram, não das pessoas alcançadas por um post.
            {audience.summary && (
              <>
                {" "}Resumo: <b>{audience.summary}</b>.
              </>
            )}
          </Caption>
        </>
      )}
    </section>
  );
}

/* ─────────────────── histórico ─────────────────── */

function History({ view }: { view: PlatformView }) {
  const [open, setOpen] = useState(false);
  const trend = view.summary.find((m) => m.key === "followers")?.trend ?? [];
  const growth = view.summary.find((m) => m.key === "growth")?.value ?? null;

  return (
    <section className="section">
      <div className="disc">
        <button className="disc-btn" aria-expanded={open} aria-controls="historico" onClick={() => setOpen((o) => !o)}>
          <span>
            <span className="h3">histórico</span>
            <span className="disc-sub">seguidores e crescimento desde o início do acompanhamento</span>
          </span>
          <span className="disc-chev">
            <ChevronDown size={18} />
          </span>
        </button>
        {open && (
          <div className="disc-body" id="historico">
            {trend.length < 2 ? (
              <Caption style={{ paddingTop: 18 }}>
                O histórico começa a acumular a partir da primeira atualização e é registrado diariamente. A curva e a
                variação de 30 dias aparecem assim que houver dias suficientes.
              </Caption>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingTop: 20 }}>
                <div className="freq" style={{ gridTemplateColumns: "repeat(2, auto)", justifyContent: "start", gap: 48 }}>
                  <div>
                    <div className="v">{formatCount(view.followers)}</div>
                    <div className="l">seguidores hoje</div>
                  </div>
                  {growth != null && (
                    <div>
                      <div className="v">{formatRate(growth)}%</div>
                      <div className="l">crescimento em 30 dias</div>
                    </div>
                  )}
                </div>
                <div>
                  <Chart
                    points={trend}
                    label="seguidores"
                    format={(n) => formatNumber(n)}
                    minSpan={Math.max(40, (view.followers ?? 0) * 0.01)}
                  />
                  <div className="chart-note">
                    <Info size={13} />
                    <Caption>Um ponto por dia. Atualizações manuais no mesmo dia não criam pontos extras.</Caption>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
