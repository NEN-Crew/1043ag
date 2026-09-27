import { redirect } from "next/navigation";
import { getInfluencerId, isAdmin } from "@/lib/auth";
import { forCreator, getReport } from "@/lib/report";
import { listDeals } from "@/lib/deals";
import { forCreatorDeals, summarize, todayBR } from "@/lib/commercial";
import { formatMoney } from "@/lib/format";
import AreaNav from "@/components/AreaNav";
import Commercial from "@/components/Commercial";
import TopBar from "@/components/TopBar";
import { Caption } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * The creator's own jobs: only theirs, read from their session on the
 * server, never from the URL. Read-only, and the agency's notes are stripped
 * before they leave the server.
 */
export default async function MyCommercialPage() {
  const id = getInfluencerId();
  if (!id) redirect(isAdmin() ? "/admin/comercial" : "/login");

  const today = todayBR();
  const [found, raw] = await Promise.all([getReport(id), listDeals(id)]);
  if (!found) redirect("/login");
  const report = forCreator(found);
  const deals = forCreatorDeals(raw);
  const view = report.platforms[0] ?? null;
  const s = summarize(deals, today);

  return (
    <>
      <TopBar
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
          <AreaNav base="/me" current="comercial" />
          <Caption>Seus orçamentos, contratos, notas e pagamentos com a 1043.</Caption>
        </div>
        <Commercial
          deals={deals}
          creators={[{ id, name: report.influencer.name }]}
          today={today}
          mode="self"
          creatorId={id}
        />
        <div className="foot-note">
          <span>1043 AG · área comercial</span>
          <span>só você e a 1043 veem estes dados</span>
        </div>
      </main>
    </>
  );
}
