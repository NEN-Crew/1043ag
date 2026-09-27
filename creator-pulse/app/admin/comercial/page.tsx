import { isAdmin } from "@/lib/auth";
import { listCreators, listDeals } from "@/lib/deals";
import { summarize, todayBR } from "@/lib/commercial";
import { formatMoney } from "@/lib/format";
import AdminGate from "@/components/AdminGate";
import AreaNav from "@/components/AreaNav";
import Commercial from "@/components/Commercial";
import TopBar from "@/components/TopBar";
import { Caption } from "@/components/ui";

export const dynamic = "force-dynamic";

/** The agency's overview of every publi, every creator. Staff only, checked here. */
export default async function AgencyCommercialPage() {
  if (!isAdmin()) return <AdminGate />;

  const today = todayBR();
  const [deals, creators] = await Promise.all([listDeals(), listCreators()]);
  const s = summarize(deals, today);

  return (
    <>
      <TopBar
        staff
        identity={{
          name: "1043 agência",
          handle: "área comercial",
          stats: [
            { value: formatMoney(s.receivable.total), label: "a receber" },
            { value: String(s.overdue.count), label: "atrasados" },
            { value: String(s.active), label: "jobs ativos" },
          ],
        }}
      />
      <main className="shell">
        <div className="controls" style={{ paddingBottom: 0 }}>
          <AreaNav base="/admin" current="comercial" />
          <Caption>Cada publi do orçamento ao pagamento. Só a 1043 vê esta visão geral.</Caption>
        </div>
        <Commercial deals={deals} creators={creators} today={today} mode="agency" />
        <div className="foot-note">
          <span>1043 AG · área comercial</span>
          <span>uso interno</span>
        </div>
      </main>
    </>
  );
}
