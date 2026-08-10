import { compact, full, ago } from "@/lib/format";

type Props = { platform: "instagram" | "tiktok"; stats: any | null };

export default function PlatformCard({ platform, stats }: Props) {
  const isIg = platform === "instagram";
  const tag = isIg ? "ig" : "tt";
  const handle = stats?.username ? `@${stats.username}` : null;

  const figures = isIg
    ? [
        { label: "Followers", value: stats?.followers },
        { label: "Following", value: stats?.following },
        { label: "Posts", value: stats?.media_count },
      ]
    : [
        { label: "Followers", value: stats?.followers },
        { label: "Likes", value: stats?.likes_total },
        { label: "Videos", value: stats?.video_count },
      ];

  const items = (isIg ? stats?.posts : stats?.videos) ?? [];

  // Account-level insight totals (Instagram only, "last day" period).
  const accountMetrics = isIg ? stats?.account_insights?.metrics : null;
  const accountFigures = accountMetrics
    ? [
        { label: "Reach (1d)", value: accountMetrics.reach },
        { label: "Views (1d)", value: accountMetrics.views },
        { label: "Engaged (1d)", value: accountMetrics.accounts_engaged },
        { label: "Interactions (1d)", value: accountMetrics.total_interactions },
      ].filter((f) => f.value != null)
    : [];

  // Top follower-demographics entry per dimension, e.g. "25-34 · F · BR".
  const demo = isIg ? stats?.demographics : null;
  const demoSummary = demo
    ? ["age", "gender", "country"]
        .map((d) => demo[d]?.[0]?.key)
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className={`card card-pad platform ${tag}`}>
      <div className="platform-head">
        <span className={`platform-tag ${tag}`}>{isIg ? "Instagram" : "TikTok"}</span>
        {handle && <span className="platform-handle">{handle}</span>}
        {stats?.updated_at && (
          <span className="platform-handle" style={{ marginLeft: "auto" }}>
            updated {ago(stats.updated_at)}
          </span>
        )}
      </div>

      <div className="statgrid">
        {figures.map((f) => (
          <div className="stat" key={f.label}>
            <span className="figure" title={full(f.value)}>{compact(f.value)}</span>
            <span className="label">{f.label}</span>
          </div>
        ))}
      </div>

      {accountFigures.length > 0 && (
        <div className="statgrid" style={{ marginTop: 10 }}>
          {accountFigures.map((f) => (
            <div className="stat" key={f.label}>
              <span className="figure" title={full(f.value)}>{compact(f.value)}</span>
              <span className="label">{f.label}</span>
            </div>
          ))}
        </div>
      )}

      {demoSummary && (
        <p className="subtle" style={{ marginTop: 10, marginBottom: 0 }}>
          Top audience: {demoSummary}
        </p>
      )}

      {items.length > 0 && (
        <div className="items">
          {items.slice(0, 6).map((it: any) => (
            <a
              className="item"
              key={it.id}
              href={isIg ? it.permalink : it.shareUrl}
              target="_blank"
              rel="noreferrer"
            >
              {it.thumbnail || it.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="item-thumb" src={isIg ? it.thumbnail : it.cover} alt="" />
              ) : (
                <span className="item-thumb" />
              )}
              <span className="item-cap">{(isIg ? it.caption : it.title) || "Untitled"}</span>
              <span className="item-metrics">
                {it.views != null && (
                  <span className="item-metric"><b>{compact(it.views)}</b> views</span>
                )}
                {isIg && it.reach != null && (
                  <span className="item-metric"><b>{compact(it.reach)}</b> reach</span>
                )}
                <span className="item-metric"><b>{compact(it.likes)}</b> likes</span>
                <span className="item-metric"><b>{compact(it.comments)}</b> comments</span>
                {isIg && it.saves != null && (
                  <span className="item-metric"><b>{compact(it.saves)}</b> saves</span>
                )}
                {isIg && it.shares != null && (
                  <span className="item-metric"><b>{compact(it.shares)}</b> shares</span>
                )}
              </span>
            </a>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="subtle" style={{ marginTop: 16, marginBottom: 0 }}>
          No recent {isIg ? "posts" : "videos"} yet.
        </p>
      )}
    </div>
  );
}
