import { Suspense } from "react";
import { isAdmin } from "@/lib/auth";
import { getRoster } from "@/lib/report";
import { formatCount, formatRate } from "@/lib/format";
import AdminGate from "@/components/AdminGate";
import CreateInfluencer from "@/components/CreateInfluencer";
import Ranking from "@/components/Ranking";
import TopBar from "@/components/TopBar";
import { Eyebrow } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // The roster is the whole client list — staff only, enforced here on the
  // server. Hiding the switcher is not access control.
  if (!isAdmin()) {
    return (
      <main className="auth">
        <div className="auth-card">
          <div className="wordmark" style={{ marginBottom: 6 }}>1043 AG</div>
          <p className="caption" style={{ marginBottom: 24 }}>Visão agência</p>
          <AdminGate />
        </div>
      </main>
    );
  }

  const roster = await getRoster();
  const { meta } = roster;

  return (
    <>
      <TopBar view="agencia" staff />
      <main className="shell">
        <div className="field grain">
          <div className="field-head" style={{ alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Eyebrow onDark>Agência · roster</Eyebrow>
              <h1 className="page-h1">Visão agência</h1>
              <p style={{ fontSize: 13, color: "rgba(229,229,229,0.82)", margin: 0 }}>
                Todos os creators da 1043, ranqueados por engajamento.
              </p>
            </div>
            <div className="field-stats">
              <div>
                <div className="field-stat-label">Creators</div>
                <div className="field-stat-value">{meta.creatorCount}</div>
              </div>
              <div>
                <div className="field-stat-label">ER médio</div>
                <div className="field-stat-value">{formatRate(meta.avgEr)}%</div>
              </div>
              <div>
                <div className="field-stat-label">Alcance total</div>
                <div className="field-stat-value">{formatCount(meta.totalReach)}</div>
              </div>
            </div>
          </div>
        </div>

        {meta.creatorCount === 0 ? (
          <section className="section first">
            <div className="section-body">
              <p className="caption">Nenhum creator ainda. Adicione o primeiro abaixo.</p>
            </div>
            <div className="section-index" aria-hidden="true">01</div>
          </section>
        ) : (
          <Suspense fallback={<div style={{ height: 320 }} />}>
            <Ranking roster={roster} />
          </Suspense>
        )}

        <CreateInfluencer />

        <div className="footer">
          <span>1043 AG · creator performance</span>
          <span>uso interno</span>
        </div>
      </main>
    </>
  );
}
