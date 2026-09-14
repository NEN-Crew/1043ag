"use client";
import { useState } from "react";

/**
 * The "Entrar" frame. Two things the design draws have no backend behind
 * them, so they answer in place instead of leading nowhere: accounts are
 * created by the agency (there is no sign-up), and a lost password is reset
 * by the agency (there is no reset flow). "Me manter conectado" is real: off,
 * the session ends when the browser closes.
 */
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState<"forgot" | "signup" | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNote(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, remember }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      window.location.href = data.redirect ?? "/me";
    } else {
      setError((await res.json()).error ?? "Não foi possível entrar");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div className="login-box">
        <div className="login-row">
          <label htmlFor="email">email</label>
          <input
            id="email"
            type="email"
            placeholder="user@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
        </div>
        <div className="login-row">
          <label htmlFor="senha">senha</label>
          <input
            id="senha"
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
      </div>

      <div className="auth-row">
        <label className="remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <i />
          me manter conectado
        </label>
        <button type="button" className="link" onClick={() => setNote(note === "forgot" ? null : "forgot")}>
          esqueci minha senha
        </button>
      </div>

      {error && <div className="auth-msg warn" role="alert">{error}</div>}
      {note === "forgot" && (
        <div className="auth-msg">
          A senha é definida pela agência. Peça uma nova para <a className="link" href="mailto:contato@1043.ag">contato@1043.ag</a> e
          ela chega por e-mail.
        </div>
      )}
      {note === "signup" && (
        <div className="auth-msg">
          As contas são criadas pela agência para os creators da 1043. Se você trabalha com a gente, escreva para{" "}
          <a className="link" href="mailto:contato@1043.ag">contato@1043.ag</a>.
        </div>
      )}

      <div className="auth-actions">
        <button className="pill" disabled={busy}>
          {busy ? "entrando…" : "entrar"}
        </button>
        <button type="button" className="pill" onClick={() => setNote(note === "signup" ? null : "signup")}>
          se cadastrar
        </button>
      </div>
    </form>
  );
}
