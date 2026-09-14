"use client";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PeriodPoint, PeriodSeries } from "@/lib/metrics";
import { formatCount, formatDelta, formatRate } from "@/lib/format";

export type PeriodMetric = "er" | "reach" | "interactions";

type Props = {
  series: PeriodSeries;
  metric: PeriodMetric;
  /** "Views" on TikTok, "Alcance" on Instagram. Names the reach line in the tooltip. */
  reachLabel: string;
  height?: number;
};

const PAD = { top: 34, right: 14, bottom: 30, left: 52 };

/**
 * Under three posts a median is barely a median. The column stays on the chart
 * — the reader should still see the period was active — but it goes hollow, so
 * the eye weighs it less than a month with a real sample behind it.
 */
const SOLID_FROM = 3;

/** Columns narrower than this can't carry a value label without colliding. */
const DENSE_BELOW = 46;

/**
 * One column per calendar period. Every column is zero-based — a column chart
 * with a clipped axis is the classic way to make a 7% and an 8% look like a
 * collapse — and the expected band sits behind the columns so each period is
 * graded on sight, without a legend to consult.
 */
export default function PeriodChart({ series, metric, reachLabel, height = 230 }: Props) {
  const { points, band } = series;
  const uid = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // Measured rather than scaled, as in Chart.tsx: a stretched viewBox would
  // distort strokes and the hatch pattern with it.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const isRate = metric === "er";
  const value = (p: PeriodPoint) => p[metric];
  const axis = (n: number) => (isRate ? `${formatRate(n)}%` : formatCount(n));
  const detail = (n: number) => (isRate ? `${formatRate(n, 2)}%` : formatCount(n));

  const geom = useMemo(() => {
    if (!points.length || width <= 0) return null;

    const values = points.map(value).filter((v): v is number => v != null);
    const maxV = values.length ? Math.max(...values) : 0;
    // The band is part of the picture when the metric is the rate, so the
    // axis has to reach it even if every column falls short of it.
    const top = nice(Math.max(maxV, isRate ? band[1] : 0) * 1.15);

    const plotW = Math.max(1, width - PAD.left - PAD.right);
    const plotH = Math.max(1, height - PAD.top - PAD.bottom);
    const slot = plotW / points.length;
    const colW = Math.max(6, Math.min(slot * 0.62, 72));
    const cx = (i: number) => PAD.left + slot * (i + 0.5);
    const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
    const dense = slot < DENSE_BELOW;

    return {
      top,
      plotW,
      plotH,
      slot,
      colW,
      cx,
      y,
      base: PAD.top + plotH,
      dense,
      labelEvery: dense ? Math.ceil(DENSE_BELOW / slot) : 1,
      ticks: [top, top / 2],
    };
  }, [points, width, height, metric, band, isRate]);

  const shown = active != null ? points[active] : null;

  /** Change against the nearest earlier period that has a value. */
  const prev = useMemo(() => {
    if (active == null) return null;
    for (let i = active - 1; i >= 0; i--) if (value(points[i]) != null) return points[i];
    return null;
  }, [active, points, metric]);

  function nearest(clientX: number) {
    const el = wrap.current;
    if (!el || !geom) return null;
    const rel = clientX - el.getBoundingClientRect().left - PAD.left;
    return Math.max(0, Math.min(points.length - 1, Math.floor(rel / geom.slot)));
  }

  const lastWithData = (() => {
    for (let i = points.length - 1; i >= 0; i--) if (value(points[i]) != null) return i;
    return points.length - 1;
  })();

  const hatchId = `hatch-${uid}`;

  return (
    <div ref={wrap} style={{ position: "relative", width: "100%", minHeight: height }}>
      {geom && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${series.unit === "week" ? "semana a semana" : "mês a mês"}: ${points
            .filter((p) => value(p) != null)
            .map((p) => `${p.label} ${detail(value(p)!)}`)
            .join(", ")}`}
          tabIndex={0}
          onFocus={() => setActive(lastWithData)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setActive((a) => {
                const next = (a ?? lastWithData) + (e.key === "ArrowRight" ? 1 : -1);
                return Math.max(0, Math.min(points.length - 1, next));
              });
            }
          }}
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={() => setActive(null)}
          style={{ display: "block", touchAction: "pan-y", outlineOffset: 2 }}
        >
          <defs>
            {/* The running period: the same cobalt, but not yet solid. */}
            <pattern
              id={hatchId}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--paper)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--cobalt)" strokeWidth="2" />
            </pattern>
          </defs>

          {/* Expected band. A flat grey field, ruled top and bottom — a tint
              would be a fifth colour, and this system has four. It is named
              in the legend, not here: a label inside the plot ends up behind
              whichever column happens to stand in front of it. */}
          {isRate && (
            <g>
              <rect
                x={PAD.left}
                y={geom.y(band[1])}
                width={geom.plotW}
                height={Math.max(0, geom.y(band[0]) - geom.y(band[1]))}
                fill="var(--ink-100)"
              />
              <line x1={PAD.left} x2={width - PAD.right} y1={geom.y(band[1])} y2={geom.y(band[1])} stroke="var(--line)" />
              <line x1={PAD.left} x2={width - PAD.right} y1={geom.y(band[0])} y2={geom.y(band[0])} stroke="var(--line)" />
            </g>
          )}

          {/* Two hairline ticks; the baseline is drawn in ink after the columns. */}
          {geom.ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                y1={geom.y(t)}
                x2={width - PAD.right}
                y2={geom.y(t)}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={geom.y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="10"
                fill="var(--ink-400)"
                fontFamily="var(--font-mono)"
              >
                {axis(t)}
              </text>
            </g>
          ))}
          <text
            x={PAD.left - 8}
            y={geom.base}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="10"
            fill="var(--ink-400)"
            fontFamily="var(--font-mono)"
          >
            {axis(0)}
          </text>

          {points.map((p, i) => {
            const v = value(p);
            const x = geom.cx(i) - geom.colW / 2;
            const isActive = active === i;
            const weak = p.posts > 0 && p.posts < SOLID_FROM && !p.partial;
            return (
              <g key={p.key}>
                {/* Full-height hit area: the pointer only has to be in the slot. */}
                <rect x={geom.cx(i) - geom.slot / 2} y={PAD.top} width={geom.slot} height={geom.plotH} fill="transparent" />

                {v != null ? (
                  <rect
                    x={x}
                    y={geom.y(v)}
                    width={geom.colW}
                    height={Math.max(1, geom.base - geom.y(v))}
                    fill={p.partial ? `url(#${hatchId})` : weak ? "var(--paper)" : "var(--cobalt)"}
                    stroke={isActive ? "var(--ink)" : p.partial || weak ? "var(--cobalt)" : "none"}
                    strokeWidth={weak ? 1.5 : 1}
                  />
                ) : (
                  // Nothing published: a slot, not a column. The mark keeps the
                  // period countable without pretending there's a value.
                  <rect x={x} y={geom.base - 2} width={geom.colW} height="2" fill="var(--line)" />
                )}

                {/* The value, in the same serif the headline wears. Hidden on
                    crowded charts except for the column under the pointer. */}
                {v != null && (!geom.dense || isActive) && (
                  <text
                    x={geom.cx(i)}
                    y={geom.y(v) - 7}
                    textAnchor="middle"
                    fontSize={isActive ? 16 : 14}
                    fill={p.partial ? "var(--ink-500)" : "var(--ink)"}
                    fontFamily="var(--font-display)"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {axis(v)}
                  </text>
                )}

                {(i % geom.labelEvery === 0 || isActive) && (
                  <text
                    x={geom.cx(i)}
                    y={height - 9}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={isActive ? 700 : 400}
                    fill={isActive ? "var(--ink)" : "var(--ink-400)"}
                    fontFamily="var(--font-mono)"
                  >
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}

          <line x1={PAD.left} x2={width - PAD.right} y1={geom.base} y2={geom.base} stroke="var(--ink)" strokeWidth="1" />
        </svg>
      )}

      {shown && geom && active != null && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 0,
            ...tooltipPlacement(geom.cx(active), width),
            background: "var(--ink)",
            color: "#e5e5e5",
            padding: "10px 12px",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 30,
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
              color: "#fff",
            }}
          >
            {value(shown) != null ? detail(value(shown)!) : "-"}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "rgba(229,229,229,0.6)",
              marginTop: 5,
            }}
          >
            {shown.title}
            {shown.partial && <span style={{ color: "var(--tint-3)" }}> · em andamento</span>}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, marginTop: 9, color: "rgba(229,229,229,0.6)" }}>
            <span>
              <b style={{ color: "#fff" }}>{shown.posts}</b> {shown.posts === 1 ? "post" : "posts"}
            </span>
            {metric !== "reach" && shown.reach != null && (
              <span>
                {reachLabel.toLowerCase()} <b style={{ color: "#fff" }}>{formatCount(shown.reach)}</b>
              </span>
            )}
            {metric !== "interactions" && shown.interactions != null && (
              <span>
                reações <b style={{ color: "#fff" }}>{formatCount(shown.interactions)}</b>
              </span>
            )}
            {metric !== "er" && shown.er != null && (
              <span>
                ER <b style={{ color: "#fff" }}>{formatRate(shown.er, 2)}%</b>
              </span>
            )}
          </div>

          {prev && value(shown) != null && (
            <PeriodDelta from={value(prev)!} to={value(shown)!} isRate={isRate} vs={prev.label} />
          )}

          {shown.partial && (
            <div style={{ fontSize: 11, marginTop: 8, color: "rgba(229,229,229,0.6)" }}>
              Posts recentes ainda acumulam reações.
            </div>
          )}

          {shown.top && (
            <div
              style={{
                display: "flex", gap: 12, marginTop: 11,
                paddingTop: 11, borderTop: "1px solid rgba(229,229,229,0.22)",
              }}
            >
              {shown.top.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shown.top.thumbnailUrl} alt="" width={56} height={56} style={{ objectFit: "cover", flex: "none" }} />
              ) : (
                <span style={{ width: 56, height: 56, background: "rgba(229,229,229,0.18)", flex: "none" }} />
              )}
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(229,229,229,0.6)" }}>
                  Melhor post · {shown.top.formatLabel}
                  {shown.top.er != null && <> · ER {formatRate(shown.top.er, 2)}%</>}
                </span>
                <span
                  style={{
                    display: "-webkit-box", fontSize: 11.5, lineHeight: 1.4,
                    color: "rgba(229,229,229,0.82)", overflow: "hidden",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}
                >
                  {shown.top.caption || "sem legenda"}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      <Legend series={series} showBand={isRate} />
    </div>
  );
}

const TIP_W = 300;

/**
 * Beside the hovered column, on whichever side has room, and never past the
 * chart's own edges. On a phone the chart is barely wider than the tooltip,
 * so it spans the chart instead of trying to sit beside anything.
 */
function tooltipPlacement(cx: number, width: number): React.CSSProperties {
  if (width < TIP_W + 120) return { left: 0, right: 0 };
  const left = cx > width / 2 ? cx - 12 - TIP_W : cx + 12;
  return { left: Math.max(0, Math.min(left, width - TIP_W)), width: TIP_W };
}

/**
 * The tooltip is ink, where cobalt has no contrast. Up is white and down keeps
 * the accent, which reads on dark exactly as it does on paper.
 */
function PeriodDelta({ from, to, isRate, vs }: { from: number; to: number; isRate: boolean; vs: string }) {
  const change = isRate ? to - from : from > 0 ? ((to - from) / from) * 100 : null;
  if (change == null || !Number.isFinite(change)) return null;
  const up = change >= 0;
  return (
    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 8, color: up ? "#fff" : "var(--tint-3)" }}>
      {up ? "▲" : "▼"} {formatDelta(change, isRate ? "pp" : "pct")}
      {isRate && " pp"}
      <span style={{ fontWeight: 400, color: "rgba(229,229,229,0.6)" }}> vs. {vs}</span>
    </div>
  );
}

/** "1,5" or "3" — a band edge, without a trailing ",0". */
const edge = (n: number) => (Number.isInteger(n) ? String(n) : formatRate(n, 1));

/** Names the band and the column styles; only mentions the ones on screen. */
function Legend({ series, showBand }: { series: PeriodSeries; showBand: boolean }) {
  const hasWeak = series.points.some((p) => p.posts > 0 && p.posts < SOLID_FROM && !p.partial);
  const hasPartial = series.points.some((p) => p.partial && p.posts > 0);
  const hasEmpty = series.points.some((p) => p.posts === 0);
  if (!showBand && !hasWeak && !hasPartial && !hasEmpty) return null;

  const box = (style: React.CSSProperties) => (
    <span style={{ display: "inline-block", width: 10, height: 10, flex: "none", ...style }} />
  );

  return (
    <p className="caption" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      {showBand && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          {box({ background: "var(--ink-100)", border: "1px solid var(--line)" })} faixa esperada ·{" "}
          {edge(series.band[0])} a {edge(series.band[1])}%
        </span>
      )}
      {hasWeak && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          {box({ border: "1.5px solid var(--cobalt)" })} 1 ou 2 posts, leitura frágil
        </span>
      )}
      {hasPartial && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          {box({
            border: "1px solid var(--cobalt)",
            background: "repeating-linear-gradient(135deg, var(--cobalt) 0 1.5px, transparent 1.5px 4px)",
          })}{" "}
          período em andamento
        </span>
      )}
      {hasEmpty && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          {box({ height: 2, background: "var(--line)" })} nenhum post
        </span>
      )}
    </p>
  );
}

/** Rounds an axis top up to a number a reader can divide in their head. */
function nice(v: number): number {
  if (!(v > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const s of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (s * mag >= v) return s * mag;
  return 10 * mag;
}
