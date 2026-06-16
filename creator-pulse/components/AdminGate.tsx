"use client";
import { useState } from "react";

export default function AdminGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) window.location.reload();
    else {
      setError((await res.json()).error ?? "Wrong password");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <div className="field">
        <label>Agency password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
      </div>
      {error && <div className="notice err">{error}</div>}
      <button className="btn btn-accent" style={{ width: "100%" }} disabled={busy}>
        {busy ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}
