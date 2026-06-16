import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="auth">
      <div className="auth-card card card-pad">
        <span className="wordmark">Pulse<span className="dot">.</span></span>
        <p className="subtle" style={{ textAlign: "center", marginTop: -8, marginBottom: 22 }}>
          Sign in to see your numbers
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
