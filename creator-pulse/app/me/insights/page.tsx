import { redirect } from "next/navigation";
import { getInfluencerId, isAdmin } from "@/lib/auth";
import { forCreator, getReport } from "@/lib/report";
import { getHistoryRows } from "@/lib/history";
import { buildInsights } from "@/lib/insights";
import { parseWindow } from "@/lib/metrics";
import InsightsView from "@/components/InsightsView";
import TopBar, { creatorStats } from "@/components/TopBar";

export const dynamic = "force-dynamic";

/**
 * The creator's own insights: the same screen the agency reads at
 * /admin/[id]/insights, scoped to the signed-in creator. Ninety days by
 * default: thirty rarely gives three posts to a weekday.
 */
export default async function MyInsightsPage({
  searchParams,
}: {
  searchParams: { janela?: string; rede?: string };
}) {
  const id = getInfluencerId();
  if (!id) redirect(isAdmin() ? "/admin" : "/login");

  const windowDays = searchParams.janela ? parseWindow(searchParams.janela) : 90;
  const [found, rows] = await Promise.all([getReport(id, windowDays), getHistoryRows(id)]);
  if (!found) redirect("/login");
  const report = forCreator(found);

  const view = report.platforms.find((p) => p.platform === searchParams.rede) ?? report.platforms[0] ?? null;
  const insights = view ? buildInsights(view, rows[view.platform], windowDays) : null;

  return (
    <>
      <TopBar
        back={{ href: view ? `/me?rede=${view.platform}` : "/me", label: "voltar para os dados" }}
        identity={{
          name: report.influencer.name,
          handle: view?.handle,
          avatarUrl: view?.avatarUrl ?? report.avatarUrl,
          stats: creatorStats(view),
        }}
      />
      <main className="shell">
        <InsightsView report={report} view={view} insights={insights} windowDays={windowDays} variant="self" />
        <div className="foot-note">
          <span>1043 AG · creator insights</span>
          <span>fim do relatório</span>
        </div>
      </main>
    </>
  );
}
