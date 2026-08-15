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
      setError((await res.json()).error ?? "Senha incorreta");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="senha-agencia">Senha da agência</label>
        <input
          id="senha-agencia"
          className="field-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
      </div>
      {error && <div className="notice warn" style={{ marginBottom: 16 }}>{error}</div>}
      <button className="btn" style={{ width: "100%", height: 42 }} disabled={busy}>
        {busy ? "Verificando…" : "Entrar"}
      </button>
    </form>
  );
}
