import type { Delta, Verdict } from "@/lib/metrics";
import { formatDelta } from "@/lib/format";

/**
 * The editorial primitives every section is assembled from. Building these
 * first is what keeps the grammar consistent — a section that reaches past
 * them for a one-off style is how a system like this comes apart.
 */

export function Eyebrow({ children, onDark }: { children: React.ReactNode; onDark?: boolean }) {
  return <div className={`eyebrow${onDark ? " on-dark" : ""}`}>{children}</div>;
}

export function Caption({
  children,
  onDark,
  style,
}: {
  children: React.ReactNode;
  onDark?: boolean;
  style?: React.CSSProperties;
}) {
  return <p className={`caption${onDark ? " on-dark" : ""}`} style={style}>{children}</p>;
}

/** The frame every section uses: content column + a numbered right gutter. */
export function Section({
  index,
  title,
  caption,
  headRight,
  first,
  children,
}: {
  index: number;
  title: string;
  caption?: string;
  headRight?: React.ReactNode;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`section${first ? " first" : ""}`}>
      <div className="section-body">
        <div className="section-head">
          <div>
            {caption && <Eyebrow>{caption}</Eyebrow>}
            <h2 className="sec-title" style={{ marginTop: caption ? 10 : 0 }}>{title}</h2>
          </div>
          {headRight}
        </div>
        <div style={{ marginTop: 26 }}>{children}</div>
      </div>
      <div className="section-index" aria-hidden="true">{String(index).padStart(2, "0")}</div>
    </section>
  );
}

/** A big serif number with a small mono unit sitting on its baseline. */
export function Stat({
  value,
  unit,
  size = 48,
  color,
}: {
  value: string;
  unit?: string | null;
  size?: number;
  color?: string;
}) {
  return (
    <span className="stat">
      <span className="stat-value" style={{ fontSize: size, color }}>{value}</span>
      {unit && <span className="stat-unit" style={{ fontSize: Math.max(13, size * 0.26) }}>{unit}</span>}
    </span>
  );
}

/** ▲ cobalt / ▼ orange-red. The glyph comes from CSS so it can't disagree. */
export function DeltaTag({ delta, suffix }: { delta: Delta | null | undefined; suffix?: string }) {
  if (!delta) return null;
  return (
    <span className={`delta ${delta.dir}`}>
      {formatDelta(delta.value, delta.unit)}
      {suffix && <span style={{ fontWeight: 400, color: "var(--ink-500)" }}>{suffix}</span>}
    </span>
  );
}

export function VerdictChip({ verdict, note }: { verdict: Verdict | null | undefined; note?: string }) {
  if (!verdict) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
      <span className={`verdict ${verdict.tone}`}>{verdict.label}</span>
      {note && <span className="caption">{note}</span>}
    </span>
  );
}

/**
 * Stroke-only sparkline. A 5×5 square marks the final point — a circle reads
 * as a different system's mark, and this one is all right angles.
 */
export function Sparkline({
  data,
  color = "var(--cobalt)",
  w = 180,
  h = 44,
  strokeW = 1.5,
  baseline,
  label,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
  strokeW?: number;
  baseline?: boolean;
  label?: string;
}) {
  // Two points is a slope, not a trend — drawing it invites reading a story
  // into a single day's movement.
  if (!data || data.length < 3) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const inset = 3;
  const x = (i: number) => (i / (data.length - 1)) * w;
  const y = (v: number) => h - inset - ((v - min) / span) * (h - inset * 2);

  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastX = Math.min(x(data.length - 1), w - 3);
  const lastY = y(data[data.length - 1]);

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label ?? "tendência"}
      style={{ maxWidth: w, display: "block", overflow: "visible" }}
    >
      {baseline && <line x1="0" y1={h - 0.5} x2={w} y2={h - 0.5} stroke="var(--line)" strokeWidth="1" />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />
      <rect x={lastX - 2.5} y={lastY - 2.5} width="5" height="5" fill={color} />
    </svg>
  );
}

export function BarRow({
  label,
  pct,
  color = "var(--cobalt)",
}: {
  label: string;
  pct: number;
  color?: string;
}) {
  return (
    <div className="bar-row">
      <span className="bar-key" title={label}>{label}</span>
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      </span>
      <span className="bar-val">{Math.round(pct)}%</span>
    </div>
  );
}
