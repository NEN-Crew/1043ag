import { redirect } from "next/navigation";
import { getInfluencerId, isAdmin } from "@/lib/auth";
import { forCreator, getReport } from "@/lib/report";
import InfoView from "@/components/InfoView";
import TopBar, { creatorStats } from "@/components/TopBar";

export const dynamic = "force-dynamic";

/** The creator's own "informações" page: what we read, how the score is built, the FAQ. */
export default async function MyInfoPage({ searchParams }: { searchParams: { rede?: string } }) {
  const id = getInfluencerId();
  if (!id) redirect(isAdmin() ? "/admin" : "/login");

  const found = await getReport(id);
  if (!found) redirect("/login");
  const report = forCreator(found);
  const view = report.platforms.find((p) => p.platform === searchParams.rede) ?? report.platforms[0] ?? null;
  const back = view ? `/me?rede=${view.platform}` : "/me";

  return (
    <>
      <TopBar
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
