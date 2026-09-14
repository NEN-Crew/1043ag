import Link from "next/link";
import type { CreatorReport } from "@/lib/report";
import type { PlatformView, Post } from "@/lib/metrics";
import type { Bucket, Growth, Insights } from "@/lib/insights";
import { MIN_CELL } from "@/lib/insights";
import { formatCount, formatFreshness, formatNumber, formatRate } from "@/lib/format";
import ReachChart from "./ReachChart";
import { PlatformIcon } from "./Icons";

/**
 * A plainer screen than the dashboard on purpose. White and grey, one
 * typeface, big numbers, hairlines: it is read to decide, not to be
 * impressed, and every block answers one question in its title. The agency
 * and the creator see the same screen; only the links and the wording change.
 */
type Props = {
  report: CreatorReport;
  view: PlatformView | null;
  insights: Insights | null;
  windowDays: number;
  /** "self" is the creator reading their own account; "agency" is staff. */
  variant: "self" | "agency";
};

const WINDOW_LABELS: Record<number, string> = { 7: "7 dias", 30: "30 dias", 90: "90 dias", 365: "12 meses" };
const WINDOWS = [30, 90, 365];

const TZ = "America/Sao_Paulo";
const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ });
const pct = (n: number | null | undefined, d = 1) => (n == null ? "–" : `${formatRate(n, d)}%`);
const num = (n: number | null | undefined) => (n == null ? "–" : formatNumber(n));
const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : formatNumber(n));

export default function InsightsView({ report, view, insights, windowDays, variant }: Props) {
  const base = variant === "self" ? "/me/insights" : `/admin/${report.influencer.id}/insights`;
  const href = (rede: string, janela: number) =>
    `${base}?rede=${rede}${janela === 90 ? "" : `&janela=${janela}`}`;

  if (!view || !insights) {
    return (
      <div className="ins">
        <div className="ins-head">
          <div>
            <div className="ins-kicker">Insights</div>
            <h1 className="ins-title">{report.influencer.name}</h1>
            <p className="ins-sub">
              Nenhuma rede conectada. Os insights aparecem quando {variant === "self" ? "você conectar" : "o creator conectar"} Instagram ou TikTok.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const i = insights;
  const primaryLabel = i.isIg ? "ER mediano" : "views medianas";

  const blocks: { title: string; lede: string; wide?: boolean; body: React.ReactNode }[] = [
    {
      title: "Quando publicar",
      lede: i.isIg
        ? "ER mediano dos posts por dia da semana e por faixa de horário, no horário de Brasília."
        : "Views medianas por dia da semana e por faixa de horário, no horário de Brasília. No TikTok o ER varia pouco; o que muda é a distribuição.",
      body: (
        <>
          <Bars buckets={i.weekday} isIg={i.isIg} />
          <div className="ins-sep" />
          <Bars buckets={i.slots} isIg={i.isIg} />
          <p className="ins-note">
            Célula em branco = menos de {MIN_CELL} posts. Primeira coluna: {primaryLabel}; segunda: {i.isIg ? "alcance mediano" : "ER mediano"}.
          </p>
        </>
      ),
    },
    ...(i.isIg
      ? [
          {
            title: "Formato",
            lede: "Reel, carrossel e foto lado a lado. O alcance diz o que a plataforma entrega; salvos e envios dizem o que o público guarda.",
            body: <Formats buckets={i.formats} />,
          },
        ]
      : []),
    {
      title: "Concentração",
      lede: `Quanto do resultado do período vem de poucos posts. ${
        i.isIg ? "Medido em reações." : "Medido em views, que é o que o For You distribui."
      }`,
      body: <Concentration c={i.concentration} />,
    },
    {
      title: "Velocidade do post",
      lede: "Que fatia das reações finais um post já tem em 24h, 48h, 72h e 7 dias. Lido dos snapshots diários, só em posts acompanhados desde o dia zero.",
      body: <Velocity v={i.velocity} isIg={i.isIg} />,
    },
    // TikTok has no format block, so hashtags move up to keep the pairs full.
    ...(i.isIg ? [] : [hashtagsBlock(i)]),
    ...(i.isIg
      ? [
          {
            title: "Alcance diário da conta",
            lede: "Contas alcançadas por dia, com ou sem post. Mede o quanto o perfil continua circulando entre uma publicação e outra.",
            wide: true,
            body: <DailyReach d={i.dailyReach} view={view} />,
          },
        ]
      : []),
    {
      title: "Seguidores e posts",
      lede: "Variação diária de seguidores com os dias de post marcados, e os posts que mais trouxeram seguidores nas 48h seguintes.",
      wide: true,
      body: <GrowthBlock g={i.growth} view={view} />,
    },
    ...(i.isIg ? [hashtagsBlock(i)] : []),
    {
      title: "Cadência",
      lede: "Ritmo de publicação no período. Intervalos longos aparecem como buracos na curva de engajamento e na entrega.",
      body: (
        <div className="ins-kpis">
          <Kpi v={i.cadence.perWeek == null ? "–" : formatRate(i.cadence.perWeek, 1)} l="posts por semana" />
          <Kpi v={i.cadence.medianGap == null ? "–" : formatRate(i.cadence.medianGap, 1)} l="dias entre posts, mediana" />
          <Kpi v={i.cadence.maxGap == null ? "–" : String(Math.round(i.cadence.maxGap))} l="dias no maior intervalo" />
          <Kpi v={i.cadence.lastPostAt ? day(i.cadence.lastPostAt) : "–"} l="último post" />
        </div>
      ),
    },
  ];

  // A block left alone on the last row stretches across it: an empty cell
  // beside it reads as something missing.
  let col = 0;
  for (const b of blocks) col = b.wide ? 0 : (col + 1) % 2;
  if (col === 1) blocks[blocks.length - 1].wide = true;

  return (
    <div className="ins">
      <div className="ins-head">
        <div style={{ minWidth: 0 }}>
          <div className="ins-kicker">Insights · {WINDOW_LABELS[windowDays] ?? `${windowDays} dias`}</div>
          <h1 className="ins-title">{view.handle ? `@${view.handle}` : report.influencer.name}</h1>
          <p className="ins-sub">
            {report.influencer.name} · {formatCount(view.followers)} seguidores no {view.label} · {i.posts}{" "}
            {i.posts === 1 ? "post" : "posts"} no período · {formatFreshness(view.updatedAt)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {report.platforms.length > 1 && (
            <nav className="ins-tabs" aria-label="Rede">
              {report.platforms.map((p) => (
                <Link key={p.platform} href={href(p.platform, windowDays)} aria-current={p.platform === view.platform}>
                  <PlatformIcon platform={p.platform} size={13} />
                  {p.label}
                </Link>
              ))}
            </nav>
          )}
          <nav className="ins-tabs" aria-label="Período">
            {WINDOWS.map((w) => (
              <Link key={w} href={href(view.platform, w)} aria-current={w === windowDays}>
                {WINDOW_LABELS[w]}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {i.posts === 0 ? (
        <div className="ins-empty" style={{ marginTop: 24 }}>
          Nenhum post no período. Amplie para 90 dias ou 12 meses.
        </div>
      ) : (
        <div className="ins-grid">
          {blocks.map((b, n) => (
            <section key={b.title} className={`ins-block${b.wide ? " wide" : ""}`}>
              <div className="ins-n">{String(n + 1).padStart(2, "0")}</div>
              <h2 className="ins-h">{b.title}</h2>
              <p className="ins-lede">{b.lede}</p>
              {b.body}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function hashtagsBlock(i: Insights) {
  return {
    title: "Hashtags",
    lede: `${i.isIg ? "Alcance" : "Views"} por quantidade de hashtags na legenda. Correlação, não causa: serve pra levantar a pergunta.`,
    body: (
      <>
        <Bars buckets={i.hashtags} isIg={i.isIg} primary="reach" />
        <p className="ins-note">Primeira coluna: {i.isIg ? "alcance mediano" : "views medianas"}; segunda: ER mediano.</p>
      </>
    ),
  };
}

function Kpi({ v, l }: { v: string; l: string }) {
  return (
    <div className="ins-kpi">
      <div className="v">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}

/**
 * One row per bucket. The primary value drives the bar and is bold; the best
 * bar is ink and the rest are grey, so the answer is visible before the
 * numbers are read.
 */
function Bars({ buckets, isIg, primary }: { buckets: Bucket[]; isIg: boolean; primary?: "reach" }) {
  const useReach = primary === "reach" || !isIg;
  const value = (b: Bucket) => (useReach ? b.reach : b.er);
  const second = (b: Bucket) => (useReach ? b.er : b.reach);
  const max = Math.max(0, ...buckets.map((b) => value(b) ?? 0));
  const best = buckets.reduce<Bucket | null>((a, b) => (value(b) != null && (a == null || value(b)! > value(a)!) ? b : a), null);

  return (
    <div className="ins-rows">
      {buckets.map((b) => {
        const v = value(b);
        return (
          <div className="ins-row" key={b.key}>
            <span className="k">{b.label}</span>
            <span className="tr">
              {v != null && max > 0 && (
                <span className={`fl${b === best ? "" : " mut"}`} style={{ width: `${(v / max) * 100}%` }} />
              )}
            </span>
            <span className="v">{v == null ? "–" : useReach ? num(v) : pct(v)}</span>
            <span className="s">
              {v == null ? `n ${b.n}` : `${useReach ? pct(second(b)) : num(second(b))} · n ${b.n}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Formats({ buckets }: { buckets: Bucket[] }) {
  const rated = buckets.filter((b) => b.er != null);
  if (!rated.length) {
    return <div className="ins-empty">Nenhum formato com {MIN_CELL} posts ou mais no período.</div>;
  }
  const bestReach = Math.max(...rated.map((b) => b.reach ?? 0));
  const bestEr = Math.max(...rated.map((b) => b.er ?? 0));
  return (
    <table className="ins-table">
      <thead>
        <tr>
          <th>Formato</th>
          <th className="r">Posts</th>
          <th className="r">Alcance</th>
          <th className="r">Salvos</th>
          <th className="r">Envios</th>
          <th className="r">ER</th>
        </tr>
      </thead>
      <tbody>
        {buckets.map((b) => (
          <tr key={b.key}>
            <td>{b.label}</td>
            <td className="r">{b.n}</td>
            <td className={`r${b.reach != null && b.reach === bestReach ? " b" : ""}`}>{num(b.reach)}</td>
            <td className="r">{num(b.saves)}</td>
            <td className="r">{num(b.shares)}</td>
            <td className={`r${b.er != null && b.er === bestEr ? " b" : ""}`}>{pct(b.er, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Concentration({ c }: { c: Insights["concentration"] }) {
  if (c.topShare == null) return <div className="ins-empty">Sem posts com métricas no período.</div>;
  return (
    <>
      <div className="ins-big">
        {formatRate(c.topShare, 0)}
        <small>%</small>
      </div>
      <p className="ins-lede" style={{ marginTop: 8 }}>
        das {c.unit} do período vieram de <b>{c.topCount}</b> de {c.total} posts, os 20% mais fortes.
      </p>
      <div className="ins-kpis">
        <Kpi v={pct(c.er, 2)} l="ER do período" />
        {c.virals > 0 ? (
          <Kpi v={pct(c.erWithoutViral, 2)} l={`ER sem ${c.virals === 1 ? "o post viral" : `os ${c.virals} posts virais`}`} />
        ) : (
          <Kpi v="0" l="posts virais no período" />
        )}
      </div>
    </>
  );
}

function Velocity({ v, isIg }: { v: Insights["velocity"]; isIg: boolean }) {
  if (v.n === 0) {
    return (
      <div className="ins-empty">
        Nenhum post acompanhado desde o dia zero por sete dias ainda.{" "}
        {v.since
          ? `Os snapshots começaram em ${day(v.since)}; a curva aparece a partir dos posts publicados depois disso.`
          : "Os snapshots começam na primeira atualização."}
      </div>
    );
  }
  return (
    <>
      <div className="ins-kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <Kpi v={pct(v.at.d1, 0)} l="em 24h" />
        <Kpi v={pct(v.at.d2, 0)} l="em 48h" />
        <Kpi v={pct(v.at.d3, 0)} l="em 72h" />
        <Kpi v={pct(v.at.d7, 0)} l="em 7 dias" />
      </div>
      <p className="ins-note">
        Mediana de {v.n} {v.n === 1 ? "post" : "posts"}, sobre {isIg ? "curtidas, comentários, salvos e envios" : "curtidas, comentários e compartilhamentos"}.
      </p>
      {v.climbing.length > 0 && (
        <>
          <div className="ins-sub" style={{ marginTop: 22, fontWeight: 600, color: "var(--g1)" }}>Ainda subindo depois do terceiro dia</div>
          <div className="ins-posts">
            {v.climbing.map((c) => (
              <PostRow key={c.post.id} post={c.post} value={`+${formatRate(c.growth, 0)}%`} meta={`${c.days} dias · ER ${pct(c.post.er, 2)}`} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function DailyReach({ d, view }: { d: Insights["dailyReach"]; view: PlatformView }) {
  if (!d) return <div className="ins-empty">Sem leituras de alcance diário nesse período. Elas são gravadas a cada atualização.</div>;
  return (
    <>
      <div className="ins-kpis">
        <Kpi v={num(d.avgReach)} l="contas alcançadas por dia, média" />
        <Kpi v={num(d.avgEngaged)} l="contas engajadas por dia, média" />
        {d.best && <Kpi v={num(d.best.reach)} l={`melhor dia · ${day(d.best.at)}`} />}
      </div>
      <div style={{ marginTop: 22 }}>
        {d.points.length >= 2 ? (
          <ReachChart
            points={d.points.map((p) => ({ at: p.at, value: p.reach }))}
            markers={view.published}
            minSpan={Math.max(100, (d.avgReach ?? 0) * 0.3)}
          />
        ) : (
          <p className="ins-note">Um dia registrado. A curva aparece com o segundo.</p>
        )}
      </div>
      <p className="ins-note">Medido na atualização das 06h e referente ao dia anterior. Traço sob o dia = post publicado.</p>
    </>
  );
}

function GrowthBlock({ g, view }: { g: Growth; view: PlatformView }) {
  if (g.deltas.length < 2) {
    return <div className="ins-empty">Menos de dois dias de histórico no período. A variação diária aparece a partir do segundo snapshot.</div>;
  }
  return (
    <>
      <div className="ins-kpis">
        <Kpi v={g.total == null ? "–" : signed(g.total)} l="seguidores no período" />
        <Kpi v={g.perDay == null ? "–" : signed(Math.round(g.perDay))} l="por dia, média" />
        {g.topDays[0] && <Kpi v={signed(g.topDays[0].delta)} l={`melhor dia · ${day(g.topDays[0].at)}`} />}
      </div>
      <DeltaBars deltas={g.deltas} />
      <div className="ins-two">
        <div>
          <div className="ins-sub" style={{ fontWeight: 600, color: "var(--g1)" }}>Posts que mais trouxeram seguidores em 48h</div>
          {g.postGains.length ? (
            <div className="ins-posts">
              {g.postGains.map((x) => (
                <PostRow
                  key={x.post.id}
                  post={x.post}
                  value={signed(x.gain)}
                  // Two days of ordinary growth is the bar: a +55 on an account
                  // gaining 20 a day is 15 the post can claim, not 55.
                  meta={`${x.post.postedAt ? day(x.post.postedAt) : ""} · ER ${pct(x.post.er, 2)}${
                    g.perDay != null ? ` · ritmo normal em 2 dias: ${signed(Math.round(g.perDay * 2))}` : ""
                  }`}
                />
              ))}
            </div>
          ) : (
            <p className="ins-note">Nenhum post com snapshots antes e 48h depois ainda.</p>
          )}
        </div>
        <div>
          <div className="ins-sub" style={{ fontWeight: 600, color: "var(--g1)" }}>Melhores dias</div>
          {g.topDays.length ? (
            <div className="ins-posts">
              {g.topDays.map((d) => (
                <div className="ins-post" key={d.at}>
                  <span className="ph" style={{ display: "grid", placeItems: "center", fontSize: 11, color: "var(--g2)" }}>{day(d.at)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="cap">{d.posts.length ? d.posts.map((p) => p.caption || p.formatLabel).join(" · ") : "sem post novo na véspera"}</span>
                    <span className="meta">
                      {d.posts.length
                        ? `${d.posts.length} ${d.posts.length === 1 ? "post" : "posts"} na véspera`
                        : "crescimento sem post: conteúdo antigo ou perfil circulando"}
                    </span>
                  </span>
                  <span className="val">{signed(d.delta)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="ins-note">Nenhum dia com ganho de seguidores no período.</p>
          )}
        </div>
      </div>
    </>
  );
}

/** Up in ink, down in grey, a tick under each day that carried a post. Static SVG, server-rendered. */
function DeltaBars({ deltas }: { deltas: Growth["deltas"] }) {
  const W = 600;
  const H = 96;
  const mid = 44;
  const max = Math.max(1, ...deltas.map((d) => Math.abs(d.delta)));
  const slot = W / deltas.length;
  const bw = Math.max(1.5, slot * 0.6);
  return (
    <div style={{ marginTop: 22 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }} role="img" aria-label="variação diária de seguidores">
        {deltas.map((d, i) => {
          const h = (Math.abs(d.delta) / max) * (mid - 4);
          return (
            <rect
              key={d.at}
              x={i * slot + (slot - bw) / 2}
              y={d.delta >= 0 ? mid - h : mid}
              width={bw}
              height={Math.max(h, 0.75)}
              fill={d.delta >= 0 ? "var(--g1)" : "var(--g3)"}
            />
          );
        })}
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="var(--g1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {deltas.map((d, i) =>
          d.posted ? <rect key={`p-${d.at}`} x={i * slot + slot / 2 - 0.75} y={H - 8} width="1.5" height="8" fill="var(--g1)" /> : null
        )}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }} className="ins-note">
        <span>{day(deltas[0].at)}</span>
        <span>traço = post publicado na véspera</span>
        <span>{day(deltas[deltas.length - 1].at)}</span>
      </div>
    </div>
  );
}

function PostRow({ post, value, meta }: { post: Post; value: string; meta: string }) {
  const inner = (
    <>
      {post.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.thumbnailUrl} alt="" />
      ) : (
        <span className="ph" />
      )}
      <span style={{ minWidth: 0 }}>
        <span className="cap">{post.caption || post.formatLabel}</span>
        <span className="meta">{post.formatLabel} · {meta}</span>
      </span>
      <span className="val">{value}</span>
    </>
  );
  return post.permalink ? (
    <a className="ins-post" href={post.permalink} target="_blank" rel="noopener noreferrer">{inner}</a>
  ) : (
    <div className="ins-post">{inner}</div>
  );
}
