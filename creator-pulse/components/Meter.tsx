import type { Component } from "@/lib/metrics";
import { toneFor } from "@/lib/format";

/**
 * One scored component of the Pulse Score: what it measured, how far along the
 * 0–100 it landed, and what normal looks like. The track is a lighter step of
 * the fill's own colour so the state reads across the whole bar.
 */
export default function Meter({ component }: { component: Component }) {
  const { label, score, display, benchmark } = component;
  const tone = toneFor(score);

  return (
    <div className="meter">
      <span className="meter-label">{label}</span>
      <span className="meter-value figure">{display}</span>
      <span className={`meter-track tone-${tone}`}>
        <span className="meter-fill" style={{ width: `${score ?? 0}%` }} />
      </span>
      <span className="meter-score figure">{score ?? "—"}</span>
      <span className="meter-bench">{benchmark}</span>
    </div>
  );
}
