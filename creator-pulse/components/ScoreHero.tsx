import type { Report } from "@/lib/report";
import { compact, full } from "@/lib/format";
import { grade } from "@/lib/benchmarks";

/**
 * The one number the page leads with. It's a follower-weighted blend of the
 * per-platform scores, so a creator who is strong where their audience actually
 * is doesn't get dragged down by a side account.
 */
export default function ScoreHero({ report }: { report: Report }) {
  const g = grade(report.overall);
  const analyses = [report.analysis.instagram, report.analysis.tiktok].filter(Boolean);
  const weakest = analyses
    .flatMap((a) => a!.components)
    .filter((c) => c.score != null)
    .sort((a, b) => a.score! - b.score!)[0];

  const typicalViews = analyses
    .map((a) => a!.typical.views)
    .filter((v): v is number => v != null)
    .reduce((a, b) => a + b, 0);

  return (
    <div className="card card-pad hero">
      <div className="hero-score">
        <div className="hero-figure figure">{report.overall ?? "—"}</div>
        <div>
          <div className="hero-label">Pulse Score</div>
          {g && <div className={`grade tone-${g.tone}`}>{g.label}</div>}
        </div>
      </div>

      <div className="hero-stats">
        <div className="kpi">
          <span className="figure" title={full(report.totalFollowers)}>{compact(report.totalFollowers)}</span>
          <span className="label">Total followers</span>
        </div>
        <div className="kpi">
          <span className="figure">{typicalViews ? compact(typicalViews) : "—"}</span>
          <span className="label">Views when you post</span>
        </div>
        <div className="kpi">
          <span className="figure">{analyses.length}</span>
          <span className="label">Platform{analyses.length === 1 ? "" : "s"} connected</span>
        </div>
      </div>

      <p className="hero-note">
        {report.overall == null
          ? "Connect an account and post a few times — the score needs recent posts to read."
          : weakest
          ? `Biggest single lift right now: ${weakest.label.toLowerCase()} (${weakest.score}/100 — ${weakest.display} against ${weakest.benchmark}).`
          : "Scored across engagement, reach, impact and consistency."}
      </p>
    </div>
  );
}
