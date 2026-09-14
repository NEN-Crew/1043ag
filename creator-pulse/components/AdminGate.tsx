"use client";
import { useState } from "react";

/**
 * The shared agency password, in the login frame's clothes. Staff with a
 * named account use /login instead; the link at the bottom says so.
 */
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
    <main className="auth">
      <div className="auth-box">
        <div className="auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/1043tm.png" alt="1043" width={191} height={102} />
        </div>
        <form onSubmit={submit} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="login-box">
            <div className="login-row">
              <label htmlFor="senha-agencia">senha da agência</label>
              <input
                id="senha-agencia"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>
          {error && <div className="auth-msg warn" role="alert">{error}</div>}
          <div className="auth-actions">
            <button className="pill" disabled={busy}>
              {busy ? "verificando…" : "entrar"}
            </button>
          </div>
        </form>
        <p className="auth-legal">
          tem uma conta de equipe? <a href="/login">entre com seu e-mail</a>
        </p>
      </div>
    </main>
  );
}
