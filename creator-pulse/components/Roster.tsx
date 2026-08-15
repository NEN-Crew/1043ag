"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Report } from "@/lib/report";
import { compact, full, ago, toneFor } from "@/lib/format";
import PlatformCard from "./PlatformCard";
import AudienceCard from "./AudienceCard";

type SortKey = "score" | "followers" | "views" | "engagement" | "value" | "name";

const COLUMNS: { key: SortKey; label: string; num: boolean }[] = [
  { key: "name", label: "Creator", num: false },
  { key: "score", label: "Score", num: true },
  { key: "followers", label: "Followers", num: true },
  { key: "views", label: "Views / post", num: true },
  { key: "engagement", label: "Engagement", num: true },
  { key: "value", label: "Media value / post", num: true },
];

/**
 * The agency's actual question is "who do I put on this campaign", which is a
 * comparison, not a list of profiles. So: one sortable grid, and a row opens
 * into the same detail the creator sees.
 *
 * A grid rather than a <table> on purpose — the expanded detail is a full card
 * layout, and inside a <td> it would be sized by the table's columns.
 */
export default function Roster({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("score");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const value = (r: Report): number | string =>
      sort === "name"
        ? r.influencer.name.toLowerCase()
        : sort === "score"
        ? r.overall ?? -1
        : sort === "followers"
        ? r.totalFollowers ?? -1
        : sort === "views"
        ? r.summary.viewsPerPost ?? -1
        : sort === "engagement"
        ? r.summary.engagementRate ?? -1
        : r.summary.mediaValue?.high ?? -1;

    return [...reports].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      return typeof av === "string" ? av.localeCompare(bv as string) : (bv as number) - av;
    });
  }, [reports, sort]);

  async function refresh(id: string) {
    setBusy(id);
    await fetch(`/api/refresh/${id}`, { method: "POST" });
    router.refresh();
    setBusy(null);
  }

  const band = reports.find((r) => r.summary.mediaValue)?.summary.mediaValue;

  return (
    <div className="card roster-card">
      <div className="roster">
        <div className="roster-row roster-head">
          {COLUMNS.map((c) => (
            <span key={c.key} className={c.num ? "num" : ""}>
              <button className={`sort ${sort === c.key ? "on" : ""}`} onClick={() => setSort(c.key)}>
                {c.label}
              </button>
            </span>
          ))}
          <span className="num">Updated</span>
        </div>

        {sorted.map((r) => {
          const isOpen = open === r.influencer.id;
          const v = r.summary.mediaValue;
          return (
            <div key={r.influencer.id}>
              <div
                className={`roster-row body ${isOpen ? "open" : ""}`}
                onClick={() => setOpen(isOpen ? null : r.influencer.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setOpen(isOpen ? null : r.influencer.id);
                }}
              >
                <span>
                  <span className="roster-name">{r.influencer.name}</span>
                  <span className="roster-pills">
                    {r.connected.instagram && <span className="pill on-ig">IG</span>}
                    {r.connected.tiktok && <span className="pill on-tt">TT</span>}
                    {!r.connected.instagram && !r.connected.tiktok && (
                      <span className="pill">not connected</span>
                    )}
                  </span>
                </span>
                <span className="num">
                  <span className={`score-pill tone-${toneFor(r.overall)} figure`}>{r.overall ?? "—"}</span>
                </span>
                <span className="num figure" title={full(r.totalFollowers)}>
                  {compact(r.totalFollowers)}
                </span>
                <span className="num figure">{compact(r.summary.viewsPerPost)}</span>
                <span className="num figure">
                  {r.summary.engagementRate == null ? "—" : `${r.summary.engagementRate.toFixed(2)}%`}
                </span>
                <span className="num figure">
                  {v ? `${v.currency}${money(v.low)}–${money(v.high)}` : "—"}
                </span>
                <span className="num roster-updated">
                  <span className="subtle">{r.summary.updatedAt ? ago(r.summary.updatedAt) : "never"}</span>
                  <button
                    className="btn btn-small"
                    disabled={busy === r.influencer.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      refresh(r.influencer.id);
                    }}
                  >
                    {busy === r.influencer.id ? "…" : "Refresh"}
                  </button>
                </span>
              </div>

              {isOpen && (
                <div className="roster-detail">
                  <p className="subtle" style={{ margin: "0 0 14px" }}>{r.influencer.email}</p>
                  <div className="stack">
                    <PlatformCard
                      analysis={r.analysis.instagram}
                      growth={r.growth.instagram}
                      variant="agency"
                    />
                    <PlatformCard
                      analysis={r.analysis.tiktok}
                      growth={r.growth.tiktok}
                      variant="agency"
                    />
                    <AudienceCard audience={r.audience} />
                    {!r.connected.instagram && !r.connected.tiktok && (
                      <p className="subtle" style={{ margin: 0 }}>
                        Nothing connected yet — send this creator their login so they can connect.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="subtle roster-foot">
        Click a creator for the full breakdown. Media value prices a typical post&apos;s views at a{" "}
        {band ? `${band.currency}${band.cpm[0]}–${band.cpm[1]}` : "market"} CPM — it&apos;s the
        bought-media floor, not a rate card, and creator fees normally sit above it.
      </p>
    </div>
  );
}

const money = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(Math.round(n));
