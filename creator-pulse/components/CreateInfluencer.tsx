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
    } else setError(data.error ?? "Não foi possível criar");
  }

  return (
    <div style={{ borderTop: "1px solid var(--line)", padding: "26px 0 32px" }}>
      <div style={{ marginBottom: 16 }}>
        <span className="micro">Adicionar creator</span>
      </div>
      <form onSubmit={submit}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="field-label" htmlFor="novo-nome">Nome</label>
            <input id="novo-nome" className="field-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="field-label" htmlFor="novo-email">E-mail</label>
            <input id="novo-email" className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn" style={{ height: 41 }} disabled={busy}>
            {busy ? "Criando…" : "Criar conta"}
          </button>
        </div>
      </form>

      {error && <div className="notice warn" style={{ marginTop: 16 }}>{error}</div>}
      {created && (
        <div className="notice" style={{ marginTop: 16, borderColor: "var(--cobalt)", color: "var(--ink)" }}>
          <div className="micro" style={{ marginBottom: 8, color: "var(--cobalt)" }}>Conta criada</div>
          Envie estes dados ao creator — a senha aparece uma única vez.
          <div style={{ marginTop: 10, display: "grid", gap: 4, fontWeight: 700 }}>
            <span>E-mail: {created.email}</span>
            <span>Senha: {created.password}</span>
            <span>Login: {created.loginUrl}</span>
          </div>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>
            Atualizar lista
          </button>
        </div>
      )}
    </div>
  );
}
