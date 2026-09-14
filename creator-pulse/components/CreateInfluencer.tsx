"use client";
import { useState } from "react";
import { Caption } from "./ui";

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
    } else setError(data.error ?? "Não foi possível criar");
  }

  return (
    <section className="section">
      <h3 className="h3" style={{ marginBottom: 14, paddingLeft: 10 }}>adicionar creator</h3>
      <div className="card">
        <form onSubmit={submit}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="field-label" htmlFor="novo-nome">nome</label>
              <input id="novo-nome" className="field-input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label className="field-label" htmlFor="novo-email">e-mail</label>
              <input id="novo-email" className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn solid" disabled={busy}>
              {busy ? "criando…" : "criar conta"}
            </button>
          </div>
        </form>
        <Caption style={{ marginTop: 12 }}>
          A senha aparece uma única vez. Envie o login para a pessoa conectar Instagram ou TikTok.
        </Caption>

        {error && <div className="notice warn" style={{ marginTop: 16 }}>{error}</div>}
        {created && (
          <div className="notice good" style={{ marginTop: 16 }}>
            <span className="micro" style={{ color: "var(--cobalt)" }}>conta criada</span>
            Envie estes dados ao creator. A senha aparece uma única vez.
            <div className="mono" style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 13, color: "var(--ink)" }}>
              <span>e-mail: <b>{created.email}</b></span>
              <span>senha: <b>{created.password}</b></span>
              <span>login: <b>{created.loginUrl}</b></span>
            </div>
            <button className="btn sm" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>
              atualizar lista
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
