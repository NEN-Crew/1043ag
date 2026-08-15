import { isAdmin } from "@/lib/auth";
import { getRoster } from "@/lib/report";
import { compact } from "@/lib/format";
import AdminGate from "@/components/AdminGate";
import CreateInfluencer from "@/components/CreateInfluencer";
import Roster from "@/components/Roster";
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

  const reports = await getRoster();
  const connected = reports.filter((r) => r.connected.instagram || r.connected.tiktok);
  const followers = sum(reports.map((r) => r.totalFollowers));
  const viewsPerRound = sum(reports.map((r) => r.summary.viewsPerPost));
  const scores = reports.map((r) => r.overall).filter((s): s is number => s != null);
  const medianScore = scores.length
    ? [...scores].sort((a, b) => a - b)[Math.floor(scores.length / 2)]
    : null;

  return (
    <>
      <header className="topbar">
        <span className="wordmark">Pulse<span className="dot">.</span></span>
        <LogoutButton />
      </header>

      <main className="shell wide stack">
        <div>
          <h1 className="page-title">Roster</h1>
          <p className="subtle">
            {reports.length} creator{reports.length === 1 ? "" : "s"}, {connected.length} connected.
            Numbers refresh daily; hit Refresh on a row to pull them now.
          </p>
        </div>

        {connected.length > 0 && (
          <div className="card card-pad">
            <div className="kpis">
              <div className="kpi">
                <span className="figure">{compact(followers)}</span>
                <span className="label">Combined followers</span>
              </div>
              <div className="kpi">
                <span className="figure">{compact(viewsPerRound)}</span>
                <span className="label">Views if everyone posts once</span>
              </div>
              <div className="kpi">
                <span className="figure">{medianScore ?? "—"}</span>
                <span className="label">Median Pulse Score</span>
              </div>
            </div>
          </div>
        )}

        <CreateInfluencer />

        {reports.length === 0 ? (
          <div className="card card-pad subtle">No creators yet. Add your first one above.</div>
        ) : (
          <Roster reports={reports} />
        )}
      </main>
    </>
  );
}

function sum(values: (number | null)[]): number | null {
  const xs = values.filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
}
