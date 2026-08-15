import type { Analysis } from "@/lib/metrics";
import type { Growth } from "@/lib/history";
import { compact, full, ago } from "@/lib/format";
import Meter from "./Meter";
import Sparkline from "./Sparkline";

type Props = {
  analysis: Analysis | null;
  growth?: Growth | null;
  /** The agency sees estimated media value; the creator doesn't — it isn't a quote. */
  variant?: "creator" | "agency";
};

const money = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(n));

export default function PlatformCard({ analysis, growth, variant = "creator" }: Props) {
  if (!analysis) return null;
  const a = analysis;
  const isIg = a.platform === "instagram";
  const tag = isIg ? "ig" : "tt";

  return (
    <div className={`card card-pad platform ${tag}`}>
      <div className="platform-head">
        <span className={`platform-tag ${tag}`}>{isIg ? "Instagram" : "TikTok"}</span>
        {a.handle && <span className="platform-handle">@{a.handle}</span>}
        <span className="chip">{a.tier.name}</span>
        {a.updatedAt && (
          <span className="platform-handle" style={{ marginLeft: "auto" }}>
            updated {ago(a.updatedAt)}
          </span>
        )}
      </div>

      <div className="score-head">
        <div>
          <div className="score-figure figure">
            {a.score ?? "—"}
            <span className="score-of">/100</span>
          </div>
          {a.grade && <div className={`grade tone-${a.grade.tone}`}>{a.grade.label}</div>}
        </div>
        <p className="score-note">{a.headline}</p>

        <div className="followers-block">
          <div className="followers-row">
            <span className="figure followers-figure" title={full(a.followers)}>
              {compact(a.followers)}
            </span>
            {growth?.points && growth.points.length > 1 && (
              <Sparkline values={growth.points.map((p) => p.followers)} />
            )}
          </div>
          <div className="label">Followers</div>
          <div className="deltas">
            <Delta change={growth?.change7 ?? null} pct={growth?.pct7 ?? null} period="7d" />
            <Delta change={growth?.change30 ?? null} pct={growth?.pct30 ?? null} period="30d" />
            {!growth?.change7 && !growth?.change30 && (
              <span className="subtle" style={{ fontSize: 12 }}>
                {growth?.since
                  ? `Tracking since ${new Date(growth.since).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                  : "Growth shows up after a few days of tracking"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="meters">
        {a.components.map((c) => (
          <Meter key={c.key} component={c} />
        ))}
      </div>

      <details className="explain">
        <summary>How this score is built</summary>
        <ul>
          {a.components.map((c) => (
            <li key={c.key}>
              <b>
                {c.label} · {Math.round(c.weight * 100)}% of the score
              </b>
              <br />
              {c.note}
            </li>
          ))}
        </ul>
        <p className="subtle" style={{ marginBottom: 0 }}>
          Each component is scored on the same scale: 50 is the bottom of what&apos;s normal,
          80 is the top of normal, 100 is double the top. Components the platform
          didn&apos;t give us data for are left out and the rest are re-weighted, so a
          missing metric never quietly costs points.
        </p>
      </details>

      {a.typical.views != null || a.typical.likes != null ? (
        <section className="block">
          <h3 className="block-title">
            Typical post{a.window ? ` · last ${a.window.posts} of them` : ""}
          </h3>
          <div className="kpis">
            <Kpi label="Views" value={a.typical.views} />
            {isIg && <Kpi label="Reach" value={a.typical.reach} />}
            <Kpi label="Likes" value={a.typical.likes} />
            <Kpi label="Comments" value={a.typical.comments} />
            {a.engagementByReach != null && (
              <Kpi label={isIg ? "Engaged of reached" : "Engaged of viewers"} text={`${a.engagementByReach.toFixed(1)}%`} />
            )}
            {variant === "agency" && a.mediaValue && (
              <Kpi
                label={`Media value · ${a.mediaValue.currency}${a.mediaValue.cpm[0]}–${a.mediaValue.cpm[1]} CPM`}
                text={`${a.mediaValue.currency}${money(a.mediaValue.low)}–${money(a.mediaValue.high)}`}
              />
            )}
          </div>
          {a.sendsPerReach != null && (
            <p className="subtle callout">
              <b className="figure">{a.sendsPerReach.toFixed(1)}%</b> of the people reached saved
              or shared a typical post — 1–2% is solid. Sends and saves are what push a post
              past the existing audience; likes barely move it.
            </p>
          )}
          <p className="subtle" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
            These are medians, not averages, so one viral post doesn&apos;t set the expectation.
          </p>
        </section>
      ) : null}

      {a.formats.length > 1 && (
        <section className="block">
          <h3 className="block-title">What works best</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Format</th>
                <th className="num">Posts</th>
                <th className="num">Typical views</th>
                <th className="num">Engagement</th>
              </tr>
            </thead>
            <tbody>
              {a.formats.map((f) => (
                <tr key={f.name}>
                  <td>{f.name}</td>
                  <td className="num figure">{f.posts}</td>
                  <td className="num figure">{compact(f.views)}</td>
                  <td className="num figure">{f.engagement == null ? "—" : `${f.engagement.toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {a.items.length > 0 && (
        <section className="block">
          <h3 className="block-title">Recent posts</h3>
          <div className="items">
            {a.items.slice(0, 8).map((it) => (
              <a className="item" key={it.id} href={it.url ?? "#"} target="_blank" rel="noreferrer">
                {it.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="item-thumb" src={it.thumb} alt="" />
                ) : (
                  <span className="item-thumb" />
                )}
                <span className="item-cap">
                  {it.id === a.best?.id && <span className="chip chip-best">Top</span>}
                  {it.caption}
                </span>
                <span className="item-metrics">
                  <Metric value={compact(it.views)} label="views" />
                  {isIg && <Metric value={compact(it.reach)} label="reach" />}
                  <Metric value={compact(it.likes)} label="likes" />
                  <Metric value={compact(it.comments)} label="comments" />
                  <Metric value={compact(it.sends)} label={isIg ? "saved / sent" : "shares"} />
                  <Metric
                    value={it.engagementByReach == null ? "—" : `${it.engagementByReach.toFixed(1)}%`}
                    label="eng."
                  />
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {a.items.length === 0 && (
        <p className="subtle" style={{ marginTop: 16, marginBottom: 0 }}>
          No recent {isIg ? "posts" : "videos"} yet — the score fills in once there are some.
        </p>
      )}

      {a.caveat && (
        <p className="subtle" style={{ marginTop: 14, marginBottom: 0, fontSize: 12 }}>
          {a.caveat}
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value, text }: { label: string; value?: number | null; text?: string }) {
  return (
    <div className="kpi">
      <span className="figure" title={value != null ? full(value) : undefined}>
        {text ?? compact(value)}
      </span>
      <span className="label">{label}</span>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  if (value === "—") return null;
  return (
    <span className="item-metric">
      <b>{value}</b> {label}
    </span>
  );
}

function Delta({ change, pct, period }: { change: number | null; pct: number | null; period: string }) {
  if (change == null) return null;
  const tone = change > 0 ? "pos" : change < 0 ? "neg" : "flat";
  const sign = change > 0 ? "+" : "";
  // A percentage that rounds to 0.0 is noise next to the absolute number.
  const showPct = pct != null && Math.abs(pct) >= 0.1;
  return (
    <span className={`delta tone-${tone}`}>
      {sign}
      {compact(change)}
      {showPct && ` (${sign}${pct!.toFixed(1)}%)`} <span className="delta-period">{period}</span>
    </span>
  );
}
