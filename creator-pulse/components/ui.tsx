import type { Delta, Verdict } from "@/lib/metrics";
import { formatDelta } from "@/lib/format";

/**
 * The primitives every screen is assembled from. Keeping them here is what
 * keeps the grammar consistent: a screen that reaches past them for a one-off
 * style is how a system like this comes apart.
 */

export function Caption({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return <p className={`caption${className ? ` ${className}` : ""}`} style={style}>{children}</p>;
}

/** A grey mono chip: "excelente", "bom", "na média". Never coloured. */
export function Chip({ children, tone }: { children: React.ReactNode; tone?: "dark" | "cobalt" }) {
  return <span className={`chip${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

export function VerdictChip({ verdict }: { verdict: Verdict | null | undefined }) {
  if (!verdict) return null;
  return <Chip>{verdict.label.toLowerCase()}</Chip>;
}

/** ▲ cobalt / ▼ grey. The glyph comes from CSS so it can't disagree. */
export function DeltaTag({ delta, suffix }: { delta: Delta | null | undefined; suffix?: string }) {
  if (!delta) return null;
  return (
    <span className={`delta ${delta.dir}`}>
      {formatDelta(delta.value, delta.unit)}
      {suffix && <span className="sfx">{suffix}</span>}
    </span>
  );
}

/** Section title row: serif heading on the left, an optional control on the right. */
export function SectionHead({
  title,
  right,
  id,
}: {
  title: string;
  right?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="section-head" id={id}>
      <h2 className="h2">{title}</h2>
      {right}
    </div>
  );
}

/** A segmented control. `cobalt` colours the active item cobalt instead of ink. */
export function Seg({
  items,
  value,
  onChange,
  label,
  cobalt,
  small,
}: {
  items: { key: string; label: React.ReactNode; disabled?: boolean; title?: string }[];
  value: string;
  onChange: (key: string) => void;
  label: string;
  cobalt?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`seg${cobalt ? " cobalt" : ""}${small ? " sm" : ""}`} role="tablist" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.key}
          role="tab"
          aria-selected={value === it.key}
          disabled={it.disabled}
          title={it.title}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** The dotted spinner from the Figma loading frame. */
export function Spinner({ small }: { small?: boolean }) {
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    return { x: 25 + Math.cos(a) * 18.6, y: 25 + Math.sin(a) * 18.6, r: i === 0 ? 6.3 : 6.1 };
  });
  return (
    <svg className={`spinner${small ? " sm" : ""}`} viewBox="0 0 50 50" aria-hidden="true">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={i === 0 ? "#000" : "#d9d9d9"} />
      ))}
    </svg>
  );
}

/**
 * Stroke-only sparkline. Three points minimum: two is a slope, not a trend.
 */
export function Sparkline({
  data,
  color = "var(--cobalt)",
  w = 180,
  h = 44,
  strokeW = 1.5,
  label,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
  strokeW?: number;
  label?: string;
}) {
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
      <path d={d} fill="none" stroke={color} strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

/** A pill bar with the share on the left and the name on the right, as in the audience cards. */
export function Bar({ label, pct, max = 100 }: { label: string; pct: number; max?: number }) {
  const width = Math.max(0, Math.min(100, (pct / Math.max(1, max)) * 100));
  return (
    <div className="bar">
      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${width}%` }} />
      </span>
      <b>{Math.round(pct)}%</b>
      <span title={label}>{label}</span>
    </div>
  );
}

const DONUT = ["var(--cobalt-2)", "var(--tint-1)", "var(--tint-2)", "var(--tint-3)", "#b9c8ff", "#d6dfff"];

/** The age donut: four cobalt tints, darkest first, with a legend beside it. */
export function Donut({ slices }: { slices: { label: string; pct: number }[] }) {
  const R = 88;
  const r = 62;
  const total = slices.reduce((a, s) => a + s.pct, 0) || 1;
  let acc = -Math.PI / 2;
  const paths = slices.map((s, i) => {
    const a0 = acc;
    const a1 = acc + (s.pct / total) * Math.PI * 2;
    acc = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (ang: number, rad: number) => `${(88 + Math.cos(ang) * rad).toFixed(2)} ${(88 + Math.sin(ang) * rad).toFixed(2)}`;
    return (
      <path
        key={s.label}
        d={`M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`}
        fill={DONUT[i % DONUT.length]}
      />
    );
  });
  return (
    <div className="donut">
      <svg viewBox="0 0 176 176" role="img" aria-label={slices.map((s) => `${s.label}: ${Math.round(s.pct)}%`).join(", ")}>
        {paths}
      </svg>
      <div className="legend">
        {slices.map((s, i) => (
          <div key={s.label}>
            <i style={{ background: DONUT[i % DONUT.length] }} />
            <span>{s.label}</span>
            <b>{Math.round(s.pct)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
