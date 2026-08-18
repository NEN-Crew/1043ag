import { redirect } from "next/navigation";
import { getInfluencerId } from "@/lib/auth";
import { getReport } from "@/lib/report";
import { parseWindow } from "@/lib/metrics";
import CreatorView from "@/components/CreatorView";
import TopBar from "@/components/TopBar";
import { Caption } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: { connected?: string; connect?: string; janela?: string };
}) {
  const id = getInfluencerId();
  if (!id) redirect("/login");

  const windowDays = parseWindow(searchParams.janela);
  const report = await getReport(id, windowDays);
  if (!report) redirect("/login");

  const { connected } = report;
  const allConnected = connected.instagram && connected.tiktok;

  return (
    <>
      <TopBar view="creator" />
      <main className="shell">
        {searchParams.connected && (
          <div className="notice" style={{ marginBottom: 20, borderColor: "var(--cobalt)", color: "var(--cobalt)" }}>
            {searchParams.connected === "instagram" ? "Instagram" : "TikTok"} conectado. Seus números estão abaixo.
          </div>
        )}
        {searchParams.connect === "error" && (
          <div className="notice warn" style={{ marginBottom: 20 }}>
            A conexão não foi concluída. Tente de novo ou fale com a agência.
          </div>
        )}

        <CreatorView report={report} variant="self" windowDays={windowDays} />

        {!allConnected && (
          <section className="section">
            <div className="section-body">
              <span className="micro">
                {connected.instagram || connected.tiktok ? "Conectar a outra rede" : "Conectar suas redes"}
              </span>
              <Caption style={{ margin: "10px 0 16px", maxWidth: 520 }}>
                Você será levado à plataforma para autorizar o acesso. Lemos apenas suas
                estatísticas. Nunca publicamos nada.
              </Caption>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {!connected.instagram && (
                  <a className="btn" href="/api/connect/instagram/start">Conectar Instagram</a>
                )}
                {!connected.tiktok && (
                  <a className="btn" href="/api/connect/tiktok/start">Conectar TikTok</a>
                )}
              </div>
            </div>
            <div className="section-index" aria-hidden="true">+</div>
          </section>
        )}

        <div className="footer">
          <span>1043 AG · creator performance</span>
          <span>fim do relatório</span>
        </div>
      </main>
    </>
  );
}
