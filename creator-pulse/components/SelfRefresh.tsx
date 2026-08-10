"use client";
import { useState } from "react";

// Influencer-facing refresh button. The 12h cooldown is enforced server-side;
// this component just reports it nicely.
export default function SelfRefresh({ influencerId }: { influencerId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/refresh/${influencerId}`, { method: "POST" });
    if (res.ok) {
      location.reload();
      return;
    }
    if (res.status === 429) {
      const d = await res.json().catch(() => ({}));
      const hours = Math.max(1, Math.ceil((d.retryInMs ?? 0) / 3600000));
      setMessage(`Numbers were refreshed recently — you can refresh again in about ${hours}h.`);
    } else {
      setMessage("Couldn’t refresh right now. Try again later.");
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn btn-accent" onClick={refresh} disabled={busy}>
        {busy ? "Updating…" : "Update my numbers"}
      </button>
      <span className="subtle" style={{ fontSize: 12 }}>
        {message ?? "Numbers also update automatically every day. Manual update: once every 12h."}
      </span>
    </div>
  );
}
