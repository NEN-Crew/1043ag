"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CreatorReport } from "@/lib/report";
import type { Audience, PlatformView, Post } from "@/lib/metrics";
import { WINDOWS, isPaid } from "@/lib/metrics";
import {
  dash,
  formatCadence,
  formatCount,
  formatFreshness,
  formatNumber,
  formatRate,
  formatRatio,
} from "@/lib/format";
import { BarRow, Caption, DeltaTag, Eyebrow, Section, Sparkline, Stat, VerdictChip } from "./ui";
import Chart from "./Chart";
import {
  Calendar,
  ChevronDown,
  Clock,
  Comment,
  Heart,
  Info,
  KindIcon,
  FormatIcon,
  PlatformIcon,
  Refresh,
  Send,
  Users,
} from "./Icons";

type Props = {
  report: CreatorReport;
  /** "self" is the creator looking at their own numbers; "agency" is staff. */
  variant: "self" | "agency";
  windowDays: number;
};

const WINDOW_LABELS: Record<number, string> = {
  7: "7 dias",
  30: "30 dias",
  90: "90 dias",
  365: "12 meses",
};

/** dd/mm — enough to check a window against a calendar. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * A date range. The year appears only when the ends fall in different ones —
 * without it a 12-month window reads "18/08 a 18/08", which looks like a single
 * day rather than a year.
 */
function rangeLabel(from: string, to: string): string {
  const a = new Date(from);
  const b = new Date(to);
  const withYear = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return a.getFullYear() === b.getFullYear()
    ? `${shortDate(from)} a ${shortDate(to)}`
    : `${withYear(a)} a ${withYear(b)}`;
}

export default function CreatorView({ report, variant, windowDays }: Props) {
  const router = useRouter();
  const [active, setActive] = useState(report.platforms[0]?.platform ?? "instagram");
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const view = report.platforms.find((p) => p.platform === active) ?? report.platforms[0] ?? null;

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
      <Masthead
        report={report}
        active={active}
        onSelect={setActive}
        onRefresh={refresh}
        refreshing={refreshing}
        variant={variant}
      />

      <WindowPicker windowDays={windowDays} />

      {view ? (
        <>
          <Engagement view={view} />
          <Reach view={view} />
          <Content view={view} />
          <AudienceDisclosure index={4} audience={report.audience} platform={view.platform} />
          <HistoryDisclosure index={5} view={view} />
          <ScoreDisclosure index={6} view={view} variant={variant} />
        </>
      ) : (
        <section className="section first">
          <div className="section-body">
            <Caption>
              Nenhuma rede conectada ainda. Conecte o Instagram ou o TikTok para o relatório aparecer.
            </Caption>
          </div>
          <div className="section-index" aria-hidden="true">01</div>
        </section>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 50,
            background: "var(--ink)", color: "#e5e5e5", border: "1px solid var(--ink)",
            padding: "12px 18px", display: "inline-flex", alignItems: "center", gap: 10,
            fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
          }}
        >
          <span style={{ width: 7, height: 7, background: "var(--accent)" }} />
          {toast}
        </div>
      )}
    </>
  );
}

/**
 * The period every aggregate below is computed over. It lives in the URL so a
 * given reading is shareable and survives a refresh.
 */
function WindowPicker({ windowDays }: { windowDays: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function set(days: number) {
    const next = new URLSearchParams(params.toString());
    if (days === 30) next.delete("janela");
    else next.set("janela", String(days));
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <div className="window-picker">
      <span className="micro">Período</span>
      <div className="segbox" role="tablist" aria-label="Período">
        {WINDOWS.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={d === windowDays}
            className="seg"
            onClick={() => set(d)}
          >
            {WINDOW_LABELS[d]}
          </button>
        ))}
      </div>
      <Caption>Todos os números abaixo são desse período.</Caption>
    </div>
  );
}

/** Nothing published in the window — say so, and say when they last did. */
function EmptyWindow({ view }: { view: PlatformView }) {
  return (
    <div className="notice" style={{ borderColor: "var(--accent)" }}>
      <div className="micro" style={{ color: "var(--accent)", marginBottom: 8 }}>
        Nenhum post no período
      </div>
      <span style={{ color: "var(--ink)", fontSize: 13 }}>
        {view.label} não teve publicações entre {rangeLabel(view.window.from, view.window.to)}.{" "}
        {view.window.lastPostAt
          ? `O último post foi em ${new Date(view.window.lastPostAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}.`
          : "Não há posts registrados."}{" "}
        Amplie o período acima para ver os números desse conteúdo.
      </span>
    </div>
  );
}

/* ─────────────────────────── masthead ─────────────────────────── */

function Masthead({
  report,
  active,
  onSelect,
  onRefresh,
  refreshing,
  variant,
}: {
  report: CreatorReport;
  active: string;
  onSelect: (p: "instagram" | "tiktok") => void;
  onRefresh: () => void;
  refreshing: boolean;
  variant: "self" | "agency";
}) {
  const view = report.platforms.find((p) => p.platform === active);
  // Each tab wears its own account's photo. The creator-level one is only a
  // fallback, so a network without a picture borrows rather than showing an
  // empty slot.
  const avatar = view?.avatarUrl ?? report.avatarUrl;

  return (
    <div className="field grain">
      <div className="field-head">
        <div className="field-identity">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar-lg" src={avatar} alt="" />
          ) : (
            <div className="avatar-lg">// foto</div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <Eyebrow onDark>
              {variant === "self" ? "Creator performance · seus números" : "Creator performance · visão individual"}
            </Eyebrow>
            <h1 className="page-h1" style={{ overflowWrap: "break-word" }}>
              {view?.handle ? `@${view.handle}` : report.influencer.name}
            </h1>
            {/* The handle, the photo and the tab are all per-network, so the
                follower count has to be too. It used to sum both platforms and
                sit here unchanged while you switched tabs, which read as a
                broken number rather than as a total. */}
            <div className="field-meta">
              <b>{report.influencer.name}</b>
              {view && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>
                    {formatCount(view.followers)} seguidores no {view.label}
                  </span>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>{view.tier.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
          {report.platforms.length > 0 && (
            <div className="segbox on-dark" role="tablist" aria-label="Rede">
              {report.platforms.map((p) => (
                <button
                  key={p.platform}
                  role="tab"
                  aria-selected={p.platform === active}
                  className="seg"
                  onClick={() => onSelect(p.platform)}
                >
                  <PlatformIcon platform={p.platform} size={15} />
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(229,229,229,0.72)" }}>
              <Clock size={13} />
              {refreshing ? "atualizando…" : formatFreshness(view?.updatedAt)}
            </span>
            <button
              className="btn btn-icon on-dark"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Atualizar números"
              title={variant === "self" ? "Atualizar (1x a cada 12h)" : "Atualizar agora"}
            >
              <Refresh size={16} className={refreshing ? "spin" : undefined} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────── 01 · engajamento ────────────────────── */

function Engagement({ view }: { view: PlatformView }) {
  const e = view.engagement;

  return (
    <Section
      index={1}
      first
      caption={`Engajamento · ${view.label} · ${rangeLabel(view.window.from, view.window.to)}`}
      title="engajamento"
    >
      {view.window.posts === 0 && <EmptyWindow view={view} />}

      <div className="hero-split" style={view.window.posts === 0 ? { display: "none" } : undefined}>
        <div className="hero-col">
          <div className="hero-rate">
            <span className="n">{formatRate(e.rate)}</span>
            <span className="u">%</span>
          </div>

          <div className="hero-delta-row">
            <DeltaTag delta={e.delta} suffix=" vs. mês ant." />
            {e.delta && <span className="vrule" />}
            <VerdictChip verdict={e.verdict} note={e.verdictNote} />
          </div>

          {/* The same engagement measured against people reached rather than
              followers — the honest read of how the content itself did. */}
          {e.byReach != null && (
            <div className="hero-yearly">
              <span className="micro">Sobre o alcance</span>
              <span className="n">{formatRate(e.byReach)}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-400)" }}>%</span>
              <span className="caption">de quem viu reagiu</span>
            </div>
          )}
        </div>
      </div>

      {view.window.posts > 0 && (
      <div className="support-row">
        <span className="support-item">
          <Comment size={14} />
          taxa de comentários <b>{e.commentsRate == null ? dash : `${formatRate(e.commentsRate, 2)}%`}</b>
        </span>
        {/* Was "curtidas : comentários 9 : 1", which nobody could parse. Same
            number, said out loud. A lower figure means more conversation. */}
        {e.likesPerComment != null && (
          <span className="support-item">
            <Heart size={14} />
            <b>1</b> comentário a cada <b>{formatNumber(e.likesPerComment)}</b> curtidas
          </span>
        )}
        {view.sendsPerReach != null && (
          <span className="support-item">
            <Users size={14} />
            salvos + enviados / alcance <b>{formatRate(view.sendsPerReach)}%</b>
          </span>
        )}
      </div>
      )}

      <section className="block-chart">
        <div style={{ marginBottom: 14 }}>
          <Eyebrow>Engajamento dia a dia</Eyebrow>
        </div>
        {e.trend.length >= 2 ? (
          <>
            <Chart
              points={e.trend}
              label="taxa de engajamento"
              format={(n) => `${formatRate(n)}%`}
              formatDetail={(n) => `${formatRate(n, 2)}%`}
              markers={view.published}
              /* One percentage point. Day-to-day movement on the same posts is
                 tiny, and without a floor the axis would magnify it into drama. */
              minSpan={1}
            />
            <Caption style={{ marginTop: 10 }}>
              Um ponto por dia. Toque, passe o mouse ou use as setas para ver o valor de cada dia.
            </Caption>
          </>
        ) : (
          <Caption>
            {e.trend.length === 1
              ? "Um dia registrado até agora. A curva começa a desenhar amanhã."
              : "A curva aparece assim que houver dois dias registrados."}
          </Caption>
        )}
      </section>

      {e.breakdown.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ marginBottom: 12 }}>
            <Eyebrow>
              Tipos de engajamento · soma dos {view.window.posts} posts ·{" "}
              {rangeLabel(view.window.from, view.window.to)}
            </Eyebrow>
          </div>
          <div
            className="ruled breakdown-grid"
            style={{ ["--cols" as any]: e.breakdown.length }}
          >
            {e.breakdown.map((b) => (
              <div className="cell" key={b.kind}>
                <span className="cell-label">
                  <KindIcon kind={b.kind} size={13} />
                  <span className="micro">{b.label}</span>
                </span>
                <span className="cell-count">{formatCount(b.count)}</span>
              </div>
            ))}
          </div>
          <Caption style={{ marginTop: 10 }}>
            Somas dos {view.window.posts} posts do período. Não se encaixam direto no ER acima
            porque o ER usa a mediana de um post, não a soma de todos.
            {/* The profile shows a lifetime figure. Naming it here is what stops
                "os números não batem" — both numbers are right, they count
                different things. */}
            {view.lifetimeLikes != null && (
              <>
                {" "}No perfil, o {view.label} mostra{" "}
                <b style={{ color: "var(--ink)" }}>{formatCount(view.lifetimeLikes)}</b> curtidas —
                esse é o total de toda a conta, desde sempre.
              </>
            )}
          </Caption>
        </div>
      )}
    </Section>
  );
}

/* ──────────────── 02 · alcance & crescimento ──────────────── */

function Reach({ view }: { view: PlatformView }) {
  return (
    <Section
      index={2}
      caption="o que o alcance está fazendo"
      title="alcance & crescimento"
      headRight={
        view.postsPerWeek != null ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-400)" }}>
            <Calendar size={13} />
            frequência · {formatCadence(view.postsPerWeek)}
          </span>
        ) : undefined
      }
    >
      <div className="ruled summary-grid">
        {view.summary.map((m) => (
          <div className="summary-cell" key={m.key}>
            <span className="micro">{m.label}</span>
            <Stat
              value={
                m.value == null
                  ? dash
                  : m.unit === "%" || m.unit === "/100"
                  ? formatRate(m.value, m.unit === "/100" ? 0 : 1)
                  : formatCount(m.value)
              }
              unit={m.value == null ? null : m.unit}
              size={48}
              color={m.key === "score" ? "var(--cobalt)" : undefined}
            />
            <div className="summary-foot">
              <DeltaTag delta={m.delta} />
              <VerdictChip verdict={m.verdict} />
            </div>
            <div className="spark-slot">
              {m.trend && m.trend.length > 2 && (
                <Sparkline
                  data={m.trend.map((p) => p.value)}
                  w={210}
                  h={26}
                  color="var(--ink-300)"
                  label={`${m.label}: de ${formatNumber(m.trend[0].value)} a ${formatNumber(
                    m.trend[m.trend.length - 1].value
                  )}`}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      {view.caveat && (
        <p className="caption" style={{ marginTop: 14 }}>{view.caveat}</p>
      )}
    </Section>
  );
}

/* ─────────────────────── 03 · conteúdo ─────────────────────── */

function Content({ view }: { view: PlatformView }) {
  const all = useMemo(() => [...view.content.higher, ...view.content.lower], [view]);
  const publi = all.filter(isPaid).length;
  const organic = all.length - publi;

  if (!all.length) {
    return (
      <Section index={3} caption="posts recentes, por engajamento" title="conteúdo">
        <Caption>Nenhum post recente com métricas ainda.</Caption>
      </Section>
    );
  }

  return (
    <Section
      index={3}
      caption="posts recentes, por engajamento"
      title="conteúdo"
      headRight={
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--ink-400)" }}>
            <span style={{ width: 7, height: 7, background: "var(--ink-300)" }} />
            {organic} orgânico
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--accent)" }}>
            <span style={{ width: 7, height: 7, background: "var(--accent)" }} />
            {publi} publi
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--ink-400)" }}>
            <Info size={12} />
            publi detectada pela descrição
          </span>
        </div>
      }
    >
      <PostGroup
        label="Mais engajamento"
        posts={view.content.higher}
        platform={view.platform}
      />
      {view.content.lower.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <PostGroup
            label="Menos engajamento"
            posts={view.content.lower}
            platform={view.platform}
            lower
          />
        </div>
      )}
      <Caption style={{ marginTop: 18 }}>
        ER de cada post ={" "}
        {view.platform === "instagram"
          ? "(curtidas + comentários + salvos + enviados)"
          : "(curtidas + comentários + compartilhamentos)"}{" "}
        ÷ seguidores — a mesma conta do número grande lá em cima. Os números na barra de cada post
        são exatamente o que entra nela, então a ordem nunca contradiz o que está à vista.
      </Caption>
    </Section>
  );
}

function PostGroup({
  label,
  posts,
  platform,
  lower,
}: {
  label: string;
  posts: Post[];
  platform: "instagram" | "tiktok";
  lower?: boolean;
}) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <span className="micro">{label}</span>
      </div>
      <div className="post-grid">
        {posts.map((p) => (
          <PostTile key={p.id} post={p} platform={platform} lower={lower} />
        ))}
      </div>
    </div>
  );
}

function PostTile({ post, platform, lower }: { post: Post; platform: "instagram" | "tiktok"; lower?: boolean }) {
  const paid = isPaid(post);
  const Wrapper = post.permalink ? "a" : "div";

  return (
    <Wrapper
      className="post"
      {...(post.permalink ? { href: post.permalink, target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <div className={`post-media ${platform === "instagram" ? "ig" : "tt"}`}>
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" />
        ) : (
          <div className={`post-hatch${lower ? " lower" : ""}`}>
            <FormatIcon format={post.format} size={26} />
          </div>
        )}
        <span className="post-chip">
          <FormatIcon format={post.format} size={12} />
          {post.formatLabel}
        </span>
        {paid && <span className="post-publi">Publi</span>}
        {post.er != null && (
          <span className={`post-er${lower ? " lower" : ""}`}>ER {formatRate(post.er, 2)}%</span>
        )}
        {/* Every input to the badge, so the number is always checkable. */}
        <span className="post-stats">
          <span className="post-stat"><Heart size={12} />{formatCount(post.likes)}</span>
          <span className="post-stat"><Comment size={12} />{formatCount(post.comments)}</span>
          {post.sends != null && (
            <span className="post-stat"><Send size={12} />{formatCount(post.sends)}</span>
          )}
        </span>
      </div>
      {post.caption && <p className="post-cap">{post.caption}</p>}
    </Wrapper>
  );
}

/* ──────────────── 04 · detalhes de audiência ──────────────── */

function Disclosure({
  index,
  title,
  subtitle,
  children,
}: {
  index: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = `disc-${index}`;

  return (
    <div className="disclosure">
      <div>
        <button
          className="disclosure-btn"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          <span>
            <span className="disclosure-title">{title}</span>
            <span className="disclosure-sub" style={{ display: "block" }}>{subtitle}</span>
          </span>
          <span className="chev"><ChevronDown size={18} /></span>
        </button>
        {open && <div className="disclosure-body" id={id}>{children}</div>}
      </div>
      <div className="section-index" aria-hidden="true" style={{ paddingTop: 26 }}>
        {String(index).padStart(2, "0")}
      </div>
    </div>
  );
}

function AudienceDisclosure({
  index,
  audience,
  platform,
}: {
  index: number;
  audience: Audience | null;
  platform: "instagram" | "tiktok";
}) {
  return (
    <Disclosure index={index} title="detalhes de audiência" subtitle="geografia · idade & gênero">
      {!audience ? (
        <Caption>
          {platform === "tiktok"
            ? "A API do TikTok não expõe dados demográficos da audiência. Os números abaixo, quando existirem, vêm do Instagram."
            : "O Instagram só reporta dados demográficos para contas com mais de 100 seguidores."}
        </Caption>
      ) : (
        <>
          {audience.summary && (
            <p style={{ fontSize: 15, marginBottom: 18 }}>{audience.summary}</p>
          )}
          <div className="audience-grid">
            {audience.geography.length > 0 && (
              <div>
                <div className="bar-block-head"><span className="micro">Geografia</span></div>
                <div style={{ display: "grid", gap: 11 }}>
                  {audience.geography.filter((g) => g.pct >= 1).slice(0, 6).map((g) => (
                    <BarRow
                      key={g.name}
                      label={g.name}
                      pct={g.pct}
                      color={g.name === "Brasil" ? "var(--cobalt)" : "var(--ink-300)"}
                    />
                  ))}
                </div>
              </div>
            )}
            {audience.age.length > 0 && (
              <div>
                <div className="bar-block-head">
                  <span className="micro">
                    Idade & gênero
                    {audience.gender &&
                      ` · ${Math.round(audience.gender.female)}% F / ${Math.round(audience.gender.male)}% M`}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 11 }}>
                  {audience.age.filter((a) => a.pct >= 1).map((a) => (
                    <BarRow key={a.label} label={a.label} pct={a.pct} color="var(--ink)" />
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="caption" style={{ marginTop: 18 }}>
            Dados de seguidores, não das pessoas alcançadas por um post específico.
          </p>
        </>
      )}
    </Disclosure>
  );
}

/* ──────────────────── 05 · histórico ──────────────────── */

function HistoryDisclosure({ index, view }: { index: number; view: PlatformView }) {
  const trend = view.summary.find((m) => m.key === "followers")?.trend ?? [];
  const growth = view.summary.find((m) => m.key === "growth")?.value ?? null;

  return (
    <Disclosure index={index} title="histórico" subtitle="seguidores e crescimento desde o início do acompanhamento">
      {trend.length < 2 ? (
        <Caption>
          O histórico começa a acumular a partir da primeira atualização e é registrado diariamente.
          A curva e a variação de 30 dias aparecem assim que houver dias suficientes.
        </Caption>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 20 }}>
          <div style={{ display: "flex", gap: 56, flexWrap: "wrap" }}>
            <div>
              <div className="micro">Seguidores hoje</div>
              <div className="display" style={{ fontSize: 44, lineHeight: 0.9, marginTop: 8 }}>
                {formatCount(view.followers)}
              </div>
            </div>
            {growth != null && (
              <div>
                <div className="micro">Crescimento · 30 dias</div>
                <div className="display" style={{ fontSize: 44, lineHeight: 0.9, marginTop: 8 }}>
                  {formatRate(growth)}%
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="micro" style={{ marginBottom: 12 }}>Seguidores · dia a dia</div>
            <Chart
              points={trend}
              label="seguidores"
              format={(n) => formatNumber(n)}
              /* Followers barely move day to day on a nano account; without a
                 floor, a handful of unfollows would look like a collapse. */
              minSpan={Math.max(40, (view.followers ?? 0) * 0.01)}
            />
            <Caption style={{ marginTop: 10 }}>
              Um ponto por dia. Toque, passe o mouse ou use as setas para ver o valor de cada dia.
            </Caption>
          </div>
          <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 8 }}>
            <Info size={13} />
            <Caption>Um ponto por dia. Atualizações manuais no mesmo dia não criam pontos extras.</Caption>
          </span>
        </div>
      )}
    </Disclosure>
  );
}

/* ──────────────── 06 · como o score é montado ──────────────── */

function ScoreDisclosure({
  index,
  view,
  variant,
}: {
  index: number;
  view: PlatformView;
  variant: "self" | "agency";
}) {
  return (
    <Disclosure
      index={index}
      title="como o score é montado"
      subtitle="engajamento · alcance · impacto · consistência"
    >
      <div style={{ paddingTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="ruled summary-grid">
          {view.components.map((c) => (
            <div className="cell" key={c.key} style={{ padding: 16 }}>
              <span className="micro">{c.label} · {Math.round(c.weight * 100)}%</span>
              <span className="cell-count">{c.score ?? dash}</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{c.display}</span>
              <span className="caption">normal: {c.benchmark}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {view.components.map((c) => (
            <p className="caption" key={c.key}>
              <b style={{ color: "var(--ink)" }}>{c.label}.</b> {c.note}
            </p>
          ))}
        </div>
        <Caption>
          Cada componente usa a mesma escala: 50 é o piso do normal, 80 é o topo do normal, 100 é o
          dobro do topo. Componentes sem dados ficam de fora e os demais são repesados, então uma
          métrica ausente nunca custa pontos silenciosamente.
        </Caption>
        {variant === "agency" && view.mediaValue && (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <div className="micro" style={{ marginBottom: 8 }}>Valor de mídia por post</div>
            <Stat
              value={`${view.mediaValue.currency}${formatNumber(view.mediaValue.low)}–${formatNumber(view.mediaValue.high)}`}
              size={30}
            />
            <Caption style={{ marginTop: 8 }}>
              As views de um post típico a um CPM de {view.mediaValue.currency}
              {view.mediaValue.cpm[0]}–{view.mediaValue.cpm[1]}. É o piso de mídia comprada, não uma
              tabela de preços — o cachê normalmente fica acima disso.
            </Caption>
          </div>
        )}
      </div>
    </Disclosure>
  );
}
