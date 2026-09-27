import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getReport } from "@/lib/report";
import { listCreators, listDeals } from "@/lib/deals";
import { summarize, todayBR } from "@/lib/commercial";
import { formatMoney } from "@/lib/format";
import AdminGate from "@/components/AdminGate";
import AreaNav from "@/components/AreaNav";
import Commercial from "@/components/Commercial";
import TopBar from "@/components/TopBar";
import { Caption } from "@/components/ui";

export const dynamic = "force-dynamic";

/** One creator's commercial tab, as the agency sees it: editable, with internal notes. */
export default async function CreatorCommercialAdminPage({ params }: { params: { id: string } }) {
  if (!isAdmin()) return <AdminGate />;

  const today = todayBR();
  const [report, deals, creators] = await Promise.all([getReport(params.id), listDeals(params.id), listCreators()]);
  if (!report) notFound();
  const view = report.platforms[0] ?? null;
  const s = summarize(deals, today);

  return (
    <>
      <TopBar
        staff
        back={{ href: "/admin/comercial", label: "visão geral" }}
        identity={{
          name: report.influencer.name,
          handle: view?.handle,
          avatarUrl: view?.avatarUrl ?? report.avatarUrl,
          stats: [
            { value: formatMoney(s.receivable.total), label: "a receber" },
            { value: String(s.active), label: "jobs ativos" },
            { value: String(deals.length), label: "orçamentos" },
          ],
        }}
      />
      <main className="shell">
        <div className="controls" style={{ paddingBottom: 0 }}>
          <AreaNav base={`/admin/${params.id}`} current="comercial" />
          <Caption>O creator vê esta mesma aba, sem as observações internas e sem editar.</Caption>
        </div>
        <Commercial deals={deals} creators={creators} today={today} mode="creator" creatorId={params.id} />
        <div className="foot-note">
          <span>1043 AG · área comercial</span>
          <span>uso interno</span>
        </div>
      </main>
    </>
  );
}
