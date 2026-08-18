import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getReport } from "@/lib/report";
import { parseWindow } from "@/lib/metrics";
import CreatorView from "@/components/CreatorView";
import TopBar from "@/components/TopBar";
import AdminGate from "@/components/AdminGate";
import { ChevronRight } from "@/components/Icons";

export const dynamic = "force-dynamic";

/** Drill-down from the ranking. Staff only, checked on the server. */
export default async function AdminCreatorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { janela?: string };
}) {
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

  const windowDays = parseWindow(searchParams.janela);
  const report = await getReport(params.id, windowDays);
  if (!report) notFound();

  return (
    <>
      <TopBar view="creator" staff />
      <main className="shell">
        <Link
          href="/admin"
          className="micro"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18 }}
        >
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
            <ChevronRight size={13} />
          </span>
          Voltar ao ranking
        </Link>

        <CreatorView report={report} variant="agency" windowDays={windowDays} />

        <div className="footer">
          <span>1043 AG · creator performance</span>
          <span>{report.influencer.email}</span>
        </div>
      </main>
    </>
  );
}
