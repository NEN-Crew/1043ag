"use client";
import { useEffect, useState } from "react";
import { compact, ago } from "@/lib/format";

type Props = { id: string; name: string; email: string };

export default function AdminInfluencer({ id, name, email }: Props) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/report/${id}`);
    if (res.ok) setReport(await res.json());
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    const res = await fetch(`/api/refresh/${id}`, { method: "POST" });
    if (res.ok) setReport((await res.json()).report);
    setRefreshing(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const ig = report?.instagram;
  const tt = report?.tiktok;
  const connected = report?.connected ?? { instagram: false, tiktok: false };
  const lastUpdated = [ig?.updated_at, tt?.updated_at].filter(Boolean).sort().slice(-1)[0];

  return (
    <div className="card card-pad">
      <div className="row-head">
        <div>
          <span className="row-name">{name}</span>{" "}
          <span className="subtle">· {email}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`pill ${connected.instagram ? "on-ig" : ""}`}>
            {connected.instagram ? "IG connected" : "IG —"}
          </span>
          <span className={`pill ${connected.tiktok ? "on-tt" : ""}`}>
            {connected.tiktok ? "TikTok connected" : "TikTok —"}
          </span>
          <button className="btn btn-accent" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="subtle" style={{ margin: 0 }}>Loading numbers…</p>
      ) : (
        <>
          <div className="mini-grid">
            <div className="mini"><span className="figure">{compact(ig?.followers)}</span><div className="label">IG followers</div></div>
            <div className="mini"><span className="figure">{compact(ig?.media_count)}</span><div className="label">IG posts</div></div>
            <div className="mini"><span className="figure">{compact(tt?.followers)}</span><div className="label">TikTok followers</div></div>
            <div className="mini"><span className="figure">{compact(tt?.likes_total)}</span><div className="label">TikTok likes</div></div>
            <div className="mini"><span className="figure">{compact(tt?.video_count)}</span><div className="label">TikTok videos</div></div>
          </div>
          <p className="subtle" style={{ marginBottom: 0, marginTop: 14 }}>
            {lastUpdated ? `Numbers updated ${ago(lastUpdated)}` : "Not connected yet — send this creator their login so they can connect."}
          </p>
        </>
      )}
    </div>
  );
}
