import type { Audience } from "@/lib/metrics";

/**
 * Who's actually on the other side. This is the half of a brief that follower
 * count can't answer, and Instagram is the only one of the two that reports it.
 */
export default function AudienceCard({ audience }: { audience: Audience | null }) {
  if (!audience) return null;

  return (
    <div className="card card-pad">
      <div className="platform-head" style={{ marginBottom: 12 }}>
        <span className="chip">Audience</span>
        <span className="platform-handle">from Instagram followers</span>
      </div>

      {audience.summary && <p className="audience-summary">{audience.summary}</p>}

      <div className="audience-grid">
        <Breakdown title="Age" rows={audience.age} />
        <Breakdown title="Gender" rows={audience.gender} />
        <Breakdown title="Top countries" rows={audience.country.slice(0, 5)} />
      </div>

      <p className="subtle" style={{ marginTop: 14, marginBottom: 0, fontSize: 12 }}>
        Instagram only reports this for accounts over 100 followers, and reports it for
        followers rather than for the people a given post reached.
      </p>
    </div>
  );
}

function Breakdown({ title, rows: all }: { title: string; rows: { key: string; pct: number }[] }) {
  // Slices that round to 0% are rows of noise; keep them out unless that would
  // empty the chart.
  const meaningful = all.filter((r) => r.pct >= 1);
  const rows = meaningful.length ? meaningful : all;
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.pct));

  return (
    <div>
      <h3 className="block-title">{title}</h3>
      <div className="bars">
        {rows.map((r) => (
          <div className="bar-row" key={r.key}>
            <span className="bar-key">{r.key}</span>
            <span className="bar-track">
              {/* Scaled to the biggest slice, so short bars stay visible. */}
              <span className="bar-fill" style={{ width: `${(r.pct / max) * 100}%` }} />
            </span>
            <span className="bar-val figure">{r.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
