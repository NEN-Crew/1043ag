import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getReport } from "@/lib/report";
import InfoView from "@/components/InfoView";
import TopBar, { creatorStats } from "@/components/TopBar";
import AdminGate from "@/components/AdminGate";

export const dynamic = "force-dynamic";

/** The same "informações" page, read by staff for one creator. */
export default async function AdminInfoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { rede?: string };
}) {
  if (!isAdmin()) return <AdminGate />;

  const report = await getReport(params.id);
  if (!report) notFound();
  const view = report.platforms.find((p) => p.platform === searchParams.rede) ?? report.platforms[0] ?? null;
  const back = view ? `/admin/${params.id}?rede=${view.platform}` : `/admin/${params.id}`;

  return (
    <>
      <TopBar
        staff
        back={{ href: back, label: "voltar para os dados" }}
        identity={{
          name: report.influencer.name,
          handle: view?.handle,
          avatarUrl: view?.avatarUrl ?? report.avatarUrl,
          stats: creatorStats(view),
        }}
      />
      <InfoView report={report} view={view} backHref={back} />
    </>
  );
}
