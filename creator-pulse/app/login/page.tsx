import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="auth">
      <div className="auth-box">
        <div className="auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/1043tm.png" alt="1043" width={191} height={102} />
        </div>
        <LoginForm />
        <p className="auth-legal">
          ao entrar, você concorda com os
          <br />
          <a href="/terms">termos de uso</a> e <a href="/privacy">políticas de privacidade</a>
        </p>
      </div>
    </main>
  );
}
