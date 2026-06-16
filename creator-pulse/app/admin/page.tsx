import { isAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import AdminGate from "@/components/AdminGate";
import CreateInfluencer from "@/components/CreateInfluencer";
import AdminInfluencer from "@/components/AdminInfluencer";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAdmin()) {
    return (
      <main className="auth">
        <div className="auth-card card card-pad">
          <span className="wordmark">Pulse<span className="dot">.</span></span>
          <p className="subtle" style={{ textAlign: "center", marginTop: -8, marginBottom: 22 }}>
            Agency view
          </p>
          <AdminGate />
        </div>
      </main>
    );
  }

  const influencers = (await sql`
    select id, name, email from influencers order by created_at desc
  `) as any[];

  return (
    <>
      <header className="topbar">
        <span className="wordmark">Pulse<span className="dot">.</span></span>
        <LogoutButton />
      </header>

      <main className="shell stack">
        <div>
          <h1 className="page-title">Roster</h1>
          <p className="subtle">{influencers.length} creator{influencers.length === 1 ? "" : "s"}. Hit refresh to pull the latest numbers.</p>
        </div>

        <CreateInfluencer />

        {influencers.length === 0 ? (
          <div className="card card-pad subtle">No creators yet. Add your first one above.</div>
        ) : (
          influencers.map((inf) => (
            <AdminInfluencer key={inf.id} id={inf.id} name={inf.name} email={inf.email} />
          ))
        )}
      </main>
    </>
  );
}
