"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PlatformView, TrendPoint } from "@/lib/metrics";
import { formatCount, formatRate } from "@/lib/format";

type Marker = PlatformView["published"][number];

type Props = {
  points: TrendPoint[];
  /** Formats a value for the axis. */
  format: (n: number) => string;
  /**
   * Formats a value for the tooltip. Defaults to `format`, but a rate needs
   * more precision here than on the axis: the whole point of hovering a day is
   * to see what actually changed, and 2,80 / 2,79 / 2,81 all round to "2,8".
   */
  formatDetail?: (n: number) => string;
  label: string;
  color?: string;
  height?: number;
  /** Content published on a given day, surfaced in that day's tooltip. */
  markers?: Marker[];
  /**
   * Smallest y-range the axis is allowed to show. Without it the axis rescales
   * to whatever the data happens to span, and a 0,02 point wiggle is drawn as
   * a dramatic collapse. This is the difference between a chart that reports
   * and a chart that lies.
   */
  minSpan: number;
  /**
   * Lowest value the axis may show. The range is centred on the data, which
   * for a count near zero puts negative numbers on the axis; a floor of 0
   * keeps "contas alcançadas" from ever reading -565.
   */
  floor?: number;
};

const PAD = { top: 16, right: 14, bottom: 26, left: 52 };

export default function Chart({
  points,
  format,
  formatDetail,
  label,
  color = "var(--cobalt)",
  height = 190,
  minSpan,
  markers,
  floor,
}: Props) {
  const detail = formatDetail ?? format;

  const day = (iso: string) => iso.slice(0, 10);
  const publishedBy = useMemo(() => {
    const m = new Map<string, Marker[]>();
    for (const k of markers ?? []) m.set(day(k.at), [...(m.get(day(k.at)) ?? []), k]);
    return m;
  }, [markers]);
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  // Measured rather than scaled: a viewBox stretched to the container would
  // distort the stroke and the dots along with it.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const geom = useMemo(() => {
    if (!points.length || width <= 0) return null;

    const values = points.map((p) => p.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const mid = (lo + hi) / 2;
    // Honour the floor, then add 15% headroom so the line never touches an edge.
    const half = Math.max((hi - lo) / 2, minSpan / 2) * 1.15;
    let domain: [number, number] = [mid - half, mid + half];
    // Honour the floor by sliding the range up, never by squashing it.
    if (floor != null && domain[0] < floor) domain = [floor, floor + 2 * half];

    const plotW = Math.max(1, width - PAD.left - PAD.right);
    const plotH = Math.max(1, height - PAD.top - PAD.bottom);
    const x = (i: number) =>
      PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = (v: number) =>
      PAD.top + plotH - ((v - domain[0]) / (domain[1] - domain[0])) * plotH;

    return {
      x,
      y,
      domain,
      plotW,
      plotH,
      ticks: [domain[1], (domain[0] + domain[1]) / 2, domain[0]],
      path: points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" "),
    };
  }, [points, width, height, minSpan, floor]);

  const shown = active != null ? points[active] : null;
  const dayPosts = shown ? publishedBy.get(day(shown.at)) ?? [] : [];
  /** Days the reader can actually aim at. Drives the hint below the chart. */
  const marked = useMemo(
    () => points.filter((p) => publishedBy.has(day(p.at))).length,
    [points, publishedBy]
  );

  function nearest(clientX: number) {
    const el = wrap.current;
    if (!el || !geom) return null;
    const rel = clientX - el.getBoundingClientRect().left;
    let best = 0;
    let bestD = Infinity;
    points.forEach((_, i) => {
      const d = Math.abs(geom.x(i) - rel);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  return (
    // The SVG only exists once the container has been measured, so the height
    // is reserved up front rather than letting the block pop in.
    <div ref={wrap} style={{ position: "relative", width: "100%", minHeight: height }}>
      {geom && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}: ${format(points[0].value)} em ${dateLabel(points[0].at)} a ${format(
            points[points.length - 1].value
          )} em ${dateLabel(points[points.length - 1].at)}`}
          tabIndex={0}
          onFocus={() => setActive(points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              setActive((a) => {
                const next = (a ?? points.length - 1) + (e.key === "ArrowRight" ? 1 : -1);
                return Math.max(0, Math.min(points.length - 1, next));
              });
            }
          }}
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={() => setActive(null)}
          style={{ display: "block", touchAction: "pan-y", outlineOffset: 2 }}
        >
          {/* Recessive hairline grid — solid, never dashed. */}
          {geom.ticks.map((t, i) => (
            <g key={i}>
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
                {format(t)}
              </text>
            </g>
          ))}

          {/* Date bookends. The hovered point names its own date in the tooltip. */}
          <text x={PAD.left} y={height - 8} fontSize="10" fill="var(--ink-400)" fontFamily="var(--font-mono)">
            {dateLabel(points[0].at)}
          </text>
          {points.length > 1 && (
            <text
              x={width - PAD.right}
              y={height - 8}
              textAnchor="end"
              fontSize="10"
              fill="var(--ink-400)"
              fontFamily="var(--font-mono)"
            >
              {dateLabel(points[points.length - 1].at)}
            </text>
          )}

          {shown && active != null && (
            <line
              x1={geom.x(active)}
              y1={PAD.top}
              x2={geom.x(active)}
              y2={PAD.top + geom.plotH}
              stroke="var(--ink)"
              strokeWidth="1"
            />
          )}

          <path
            d={geom.path}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((p, i) => (
            <g key={p.at}>
              {/* The mark is 5px; the hit area is 24px, so the pointer only has
                  to be closest, not dead-centre. */}
              <rect
                x={geom.x(i) - 12}
                y={PAD.top}
                width="24"
                height={geom.plotH}
                fill="transparent"
              />
              <rect
                x={geom.x(i) - 2.5}
                y={geom.y(p.value) - 2.5}
                width="5"
                height="5"
                fill={color}
                stroke="var(--paper)"
                strokeWidth="2"
                paintOrder="stroke"
              />
              {active === i && (
                <rect
                  x={geom.x(i) - 4}
                  y={geom.y(p.value) - 4}
                  width="8"
                  height="8"
                  fill={color}
                  stroke="var(--paper)"
                  strokeWidth="2"
                  paintOrder="stroke"
                />
              )}
            </g>
          ))}

          {/* A tick under every day that carries a post. Without it the tooltip's
              content is undiscoverable: on an account that publishes six times a
              month, five hovers out of six land on a day with nothing to show,
              and the feature reads as missing. */}
          {points.map((p, i) =>
            publishedBy.has(day(p.at)) ? (
              <rect
                key={`pub-${p.at}`}
                x={geom.x(i) - 0.5}
                y={PAD.top + geom.plotH + 4}
                width="1"
                height={active === i ? 9 : 6}
                fill="var(--ink)"
              />
            ) : null
          )}
        </svg>
      )}

      {shown && geom && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: Math.min(Math.max(geom.x(active!) , PAD.left), width - PAD.right),
            top: 0,
            transform: `translateX(${geom.x(active!) > width / 2 ? "calc(-100% - 10px)" : "10px"})`,
            background: "var(--ink)",
            color: "#e5e5e5",
            padding: "10px 12px",
            pointerEvents: "none",
            // A day with a post needs room for a thumbnail and a caption; a day
            // without one should stay as small as its two lines.
            whiteSpace: dayPosts.length ? "normal" : "nowrap",
            // Never wider than the phone it's being read on.
            width: dayPosts.length ? "min(326px, calc(100vw - 56px))" : "auto",
            zIndex: 2,
          }}
        >
          {/* The rate is the headline of the whole screen; in here it wears the
              same serif it wears out there, rather than shrinking to a label. */}
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 30,
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
              color: "#fff",
            }}
          >
            {detail(shown.value)}
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
            {fullDateLabel(shown.at)}
          </div>
          {dayPosts.slice(0, 2).map((k, i) => (
            <div
              key={i}
              style={{
                display: "flex", gap: 12, marginTop: 11,
                paddingTop: 11, borderTop: "1px solid rgba(229,229,229,0.22)",
              }}
            >
              {k.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={k.thumbnailUrl} alt="" width={72} height={72} style={{ objectFit: "cover", flex: "none" }} />
              ) : (
                <span style={{ width: 72, height: 72, background: "rgba(229,229,229,0.18)", flex: "none" }} />
              )}
              <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <span
                    style={{
                      padding: "2px 6px", background: "rgba(229,229,229,0.16)", fontSize: 9,
                      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    }}
                  >
                    {k.formatLabel}
                  </span>
                  {/* Only the labels that credit the post. "Abaixo da média" is
                      information the post grid already carries; stamping it on a
                      hover the creator didn't ask for is a different act. */}
                  {(k.standout === "viral" || k.standout === "high") && (
                    <span
                      style={{
                        padding: "2px 6px", fontSize: 9, fontWeight: 700,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        background: k.standout === "viral" ? "var(--cobalt)" : "transparent",
                        color: "#fff",
                        boxShadow: k.standout === "high" ? "inset 0 0 0 1px rgba(229,229,229,0.5)" : undefined,
                      }}
                    >
                      {k.standout === "viral" ? "Viral" : "Acima da média"}
                    </span>
                  )}
                </span>
                <span
                  style={{
                    display: "-webkit-box", fontSize: 11.5, lineHeight: 1.4,
                    color: "rgba(229,229,229,0.82)", overflow: "hidden",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical", whiteSpace: "normal",
                  }}
                >
                  {k.caption || "publicado nesse dia"}
                </span>
                <span style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11 }}>
                  {k.likes != null && (
                    <span style={{ color: "rgba(229,229,229,0.6)" }}>
                      <b style={{ color: "#fff" }}>{formatCount(k.likes)}</b> curtidas
                    </span>
                  )}
                  {k.comments != null && (
                    <span style={{ color: "rgba(229,229,229,0.6)" }}>
                      <b style={{ color: "#fff" }}>{formatCount(k.comments)}</b> coment.
                    </span>
                  )}
                  {k.er != null && (
                    <span style={{ color: "rgba(229,229,229,0.6)" }}>
                      ER <b style={{ color: "#fff" }}>{formatRate(k.er, 2)}%</b>
                    </span>
                  )}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The ticks only work if the reader knows what they are. */}
      {marked > 0 && (
        <p className="caption" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 1, height: 10, background: "var(--ink)", flex: "none" }} />
          {marked === 1 ? "1 dia com publicação" : `${marked} dias com publicação`} · passe o
          mouse para ver o post
        </p>
      )}
    </div>
  );
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function fullDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}
