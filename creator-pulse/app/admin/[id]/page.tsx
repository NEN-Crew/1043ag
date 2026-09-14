import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getReport } from "@/lib/report";
import { parseWindow } from "@/lib/metrics";
import CreatorView from "@/components/CreatorView";
import AdminGate from "@/components/AdminGate";

export const dynamic = "force-dynamic";

/** Drill-down from the ranking. Staff only, checked on the server. */
export default async function AdminCreatorPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { janela?: string; rede?: string };
}) {
  if (!isAdmin()) return <AdminGate />;

  const windowDays = parseWindow(searchParams.janela);
  const report = await getReport(params.id, windowDays);
  if (!report) notFound();

  return <CreatorView report={report} variant="agency" windowDays={windowDays} />;
}
