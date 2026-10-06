import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getProfileByHandle, listSnapshots } from "@/lib/hunt";
import { HUNT_DEFAULT_WINDOW, buildProspect } from "@/lib/hunt-metrics";
import { WINDOWS } from "@/lib/metrics";
import AdminGate from "@/components/AdminGate";
import ProspectView from "@/components/hunt/ProspectView";

export const dynamic = "force-dynamic";

/** Like parseWindow(), but the hunt's default is 90 days, not 30. */
function huntWindow(raw: string | undefined): number {
  const n = Number(raw);
  return (WINDOWS as readonly number[]).includes(n) ? n : HUNT_DEFAULT_WINDOW;
}

/** One prospect. Staff only, checked on the server; the handle is the URL key. */
export default async function ProspectPage({
  params,
  searchParams,
}: {
  params: { rede: string; handle: string };
  searchParams: { janela?: string };
}) {
  if (!isAdmin()) return <AdminGate />;
  if (params.rede !== "instagram" && params.rede !== "tiktok") notFound();

  const handle = decodeURIComponent(params.handle).toLowerCase().replace(/^@/, "");
  const profile = await getProfileByHandle(params.rede, handle);
  if (!profile || !profile.fetched_at) notFound();

  const windowDays = huntWindow(searchParams.janela);
  const prospect = await buildProspect(profile, await listSnapshots(profile.id), windowDays);

  return <ProspectView prospect={prospect} windowDays={windowDays} />;
}
