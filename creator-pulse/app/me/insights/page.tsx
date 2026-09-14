import Link from "next/link";
import { redirect } from "next/navigation";
import { getInfluencerId, isAdmin } from "@/lib/auth";
import { forCreator, getReport } from "@/lib/report";
import { getHistoryRows } from "@/lib/history";
import { buildInsights } from "@/lib/insights";
import { parseWindow } from "@/lib/metrics";
import InsightsView from "@/components/InsightsView";
import TopBar from "@/components/TopBar";
import { ChevronRight } from "@/components/Icons";

export const dynamic = "force-dynamic";

/**
 * The creator's own insights: the same screen the agency reads at
 * /admin/[id]/insights, scoped to the signed-in creator. Ninety days by
 * default, for the same reason: thirty rarely gives three posts to a weekday.
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

  const view =
    report.platforms.find((p) => p.platform === searchParams.rede) ?? report.platforms[0] ?? null;
  const insights = view ? buildInsights(view, rows[view.platform], windowDays) : null;

  return (
    <>
      <TopBar view="creator" />
      <main className="shell">
        <Link
          href="/me"
          className="micro"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18 }}
        >
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
            <ChevronRight size={13} />
          </span>
          Voltar aos seus números
        </Link>

        <InsightsView report={report} view={view} insights={insights} windowDays={windowDays} variant="self" />

        <div className="footer">
          <span>1043 AG · creator insights</span>
          <span>fim do relatório</span>
        </div>
      </main>
    </>
  );
}
