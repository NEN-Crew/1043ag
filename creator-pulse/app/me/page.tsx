import { redirect } from "next/navigation";
import { getInfluencerId, isAdmin } from "@/lib/auth";
import { forCreator, getReport } from "@/lib/report";
import { parseWindow } from "@/lib/metrics";
import CreatorView from "@/components/CreatorView";
import { Caption } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: { connected?: string; connect?: string; janela?: string; rede?: string };
}) {
  const id = getInfluencerId();
  if (!id) redirect(isAdmin() ? "/admin" : "/login");

  const windowDays = parseWindow(searchParams.janela);
  const found = await getReport(id, windowDays);
  if (!found) redirect("/login");
  const report = forCreator(found);

  const { connected } = report;
  const allConnected = connected.instagram && connected.tiktok;

  const notices = (
    <>
      {searchParams.connected && (
        <div className="notice good" style={{ marginTop: 28 }}>
          {searchParams.connected === "instagram" ? "Instagram" : "TikTok"} conectado. Seus números estão abaixo.
        </div>
      )}
      {searchParams.connect === "error" && (
        <div className="notice warn" style={{ marginTop: 28 }}>
          A conexão não foi concluída. Tente de novo ou fale com a agência.
        </div>
      )}
    </>
  );

  const after = !allConnected ? (
    <section className="section">
      <div className="card">
        <h3 className="h3">
          {connected.instagram || connected.tiktok ? "conectar a outra rede" : "conectar suas redes"}
        </h3>
        <Caption style={{ margin: "10px 0 18px", maxWidth: 520 }}>
          Você será levado à plataforma para autorizar o acesso. Lemos apenas suas estatísticas. Nunca publicamos nada.
        </Caption>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {!connected.instagram && (
            <a className="btn cobalt" href="/api/connect/instagram/start">conectar instagram</a>
          )}
          {!connected.tiktok && (
            <a className="btn cobalt" href="/api/connect/tiktok/start">conectar tiktok</a>
          )}
        </div>
      </div>
    </section>
  ) : null;

  return <CreatorView report={report} variant="self" windowDays={windowDays} notices={notices} after={after} />;
}
