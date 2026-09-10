import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getReport } from "@/lib/report";
import { getHistoryRows } from "@/lib/history";
import { buildInsights } from "@/lib/insights";
import { parseWindow } from "@/lib/metrics";
import InsightsView from "@/components/InsightsView";
import TopBar from "@/components/TopBar";
import AdminGate from "@/components/AdminGate";
import { ChevronRight } from "@/components/Icons";

export const dynamic = "force-dynamic";

/**
 * The agency's reading of one creator: when to publish, which format carries
 * the account, how fast posts close, what the profile reaches between posts.
 * Staff only, checked on the server. Ninety days by default: the cuts here are
 * medians per cell, and thirty days rarely gives three posts to a weekday.
 */
export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { janela?: string; rede?: string };
}) {
  if (!isAdmin()) {
    return (
      <main className="auth">
        <div className="auth-card">
          <div className="wordmark" style={{ marginBottom: 6 }}>1043 AG</div>
          <p className="caption" style={{ marginBottom: 24 }}>Visão agência</p>
          <AdminGate />
          <p className="caption" style={{ textAlign: "center", marginTop: 20, fontSize: 11 }}>
            Tem uma conta de equipe?{" "}
            <a href="/login" style={{ textDecoration: "underline" }}>Entre com seu e-mail</a>
          </p>
        </div>
      </main>
    );
  }

  const windowDays = searchParams.janela ? parseWindow(searchParams.janela) : 90;
  const [report, rows] = await Promise.all([getReport(params.id, windowDays), getHistoryRows(params.id)]);
  if (!report) notFound();

  const view =
    report.platforms.find((p) => p.platform === searchParams.rede) ?? report.platforms[0] ?? null;
  const insights = view ? buildInsights(view, rows[view.platform], windowDays) : null;

  return (
    <>
      <TopBar view="creator" staff />
      <main className="shell">
        <Link
          href={`/admin/${report.influencer.id}`}
          className="micro"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18 }}
        >
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
            <ChevronRight size={13} />
          </span>
          Voltar ao perfil
        </Link>

        <InsightsView report={report} view={view} insights={insights} windowDays={windowDays} />

        <div className="footer">
          <span>1043 AG · creator insights</span>
          <span>uso interno</span>
        </div>
      </main>
    </>
  );
}
