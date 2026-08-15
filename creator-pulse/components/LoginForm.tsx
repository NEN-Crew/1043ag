"use client";
import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) window.location.href = "/me";
    else {
      setError((await res.json()).error ?? "Não foi possível entrar");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="email">E-mail</label>
        <input
          id="email"
          className="field-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label className="field-label" htmlFor="senha">Senha</label>
        <input
          id="senha"
          className="field-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <div className="notice warn" style={{ marginBottom: 16 }}>{error}</div>}
      <button className="btn" style={{ width: "100%", height: 42 }} disabled={busy}>
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
