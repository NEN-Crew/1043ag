import { Suspense } from "react";
import { isAdmin } from "@/lib/auth";
import { getRoster } from "@/lib/report";
import { formatCount, formatRate } from "@/lib/format";
import AdminGate from "@/components/AdminGate";
import CreateInfluencer from "@/components/CreateInfluencer";
import Ranking from "@/components/Ranking";
import TopBar from "@/components/TopBar";
import ExportButtons from "@/components/ExportButtons";
import { Caption, Spinner } from "@/components/ui";
import { DEFAULT_WINDOW } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // The roster is the whole client list — staff only, enforced here on the
  // server. Hiding the switcher is not access control.
  if (!isAdmin()) return <AdminGate />;

  const roster = await getRoster();
  const { meta } = roster;

  return (
    <>
      <TopBar
        staff
        identity={{
          name: "1043 agência",
          handle: "visão agência",
          stats: [
            { value: String(meta.creatorCount), label: "creators" },
            { value: `${formatRate(meta.avgEr)}%`, label: "er médio" },
            { value: formatCount(meta.totalReach), label: "alcance total" },
          ],
        }}
      />
      <main className="shell">
        <div className="controls">
          <Caption>Todos os creators da 1043, ranqueados por engajamento nos últimos {DEFAULT_WINDOW} dias.</Caption>
          {meta.connectedCount > 0 && <ExportButtons windowDays={DEFAULT_WINDOW} />}
        </div>

        {meta.creatorCount === 0 ? (
          <div className="notice">Nenhum creator ainda. Adicione o primeiro abaixo.</div>
        ) : (
          <Suspense fallback={<div style={{ display: "grid", placeItems: "center", height: 320 }}><Spinner small /></div>}>
            <Ranking roster={roster} />
          </Suspense>
        )}

        <CreateInfluencer />

        <div className="foot-note">
          <span>1043 AG · creator performance</span>
          <span>uso interno</span>
        </div>
      </main>
    </>
  );
}
