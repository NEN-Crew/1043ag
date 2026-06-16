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
                {!isIg && (
                  <span className="item-metric"><b>{compact(it.views)}</b> views</span>
                )}
                <span className="item-metric"><b>{compact(it.likes)}</b> likes</span>
                <span className="item-metric"><b>{compact(it.comments)}</b> comments</span>
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
