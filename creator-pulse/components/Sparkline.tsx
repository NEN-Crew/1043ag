/**
 * Follower history, at the size of a word. No axes, no gridlines — the number
 * beside it carries the value; this only carries the shape.
 */
type Props = { values: number[]; width?: number; height?: number };

export default function Sparkline({ values, width = 96, height = 26 }: Props) {
  // A line needs two points to mean anything, and twelve is as many as reads
  // at this size, so long histories are sampled down rather than crammed in.
  const sampled = sample(values, 12);
  if (sampled.length < 2) return null;

  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (sampled.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);

  const path = sampled.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastX = x(sampled.length - 1);
  const lastY = y(sampled[sampled.length - 1]);

  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke="var(--spark-line)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* The end dot rides a surface-coloured ring so it stays legible on the line. */}
      <circle cx={lastX} cy={lastY} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

function sample(values: number[], n: number): number[] {
  if (values.length <= n) return values;
  const step = (values.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => values[Math.round(i * step)]);
}
