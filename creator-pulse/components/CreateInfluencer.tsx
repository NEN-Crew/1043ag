"use client";
import { useState } from "react";

export default function CreateInfluencer() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<null | { email: string; password: string; loginUrl: string }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCreated(null);
    const res = await fetch("/api/admin/influencers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setCreated(data);
      setName("");
      setEmail("");
    } else setError(data.error ?? "Could not create");
  }

  return (
    <div className="card card-pad">
      <div className="row-name" style={{ marginBottom: 14 }}>Add a creator</div>
      <form onSubmit={submit}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-accent" style={{ alignSelf: "flex-end" }} disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>

      {error && <div className="notice err" style={{ marginTop: 14 }}>{error}</div>}
      {created && (
        <div className="notice ok" style={{ marginTop: 14 }}>
          Account created. Share these with the creator (the password is shown only once):<br />
          Email <span className="cred">{created.email}</span>{" "}
          Password <span className="cred">{created.password}</span><br />
          Login at <span className="cred">{created.loginUrl}</span>
        </div>
      )}
      {created && (
        <button className="btn" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
          Refresh list
        </button>
      )}
    </div>
  );
}
