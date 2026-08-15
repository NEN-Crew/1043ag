import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="wordmark" style={{ marginBottom: 6 }}>1043 AG</div>
        <p className="caption" style={{ marginBottom: 24 }}>
          Entre para ver a performance das suas redes.
        </p>
        <LoginForm />
        <p className="caption" style={{ textAlign: "center", marginTop: 20, fontSize: 11 }}>
          <a href="/terms" style={{ textDecoration: "underline" }}>Termos de uso</a>
          {" · "}
          <a href="/privacy" style={{ textDecoration: "underline" }}>Política de privacidade</a>
        </p>
      </div>
    </main>
  );
}
