import { redirect } from "next/navigation";
import { getInfluencerId } from "@/lib/auth";
import { getReport } from "@/lib/report";
import PlatformCard from "@/components/PlatformCard";
import AudienceCard from "@/components/AudienceCard";
import ScoreHero from "@/components/ScoreHero";
import LogoutButton from "@/components/LogoutButton";
import SelfRefresh from "@/components/SelfRefresh";

export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: { connected?: string; connect?: string };
}) {
  const id = getInfluencerId();
  if (!id) redirect("/login");

  const report = await getReport(id);
  if (!report) redirect("/login");

  const { connected } = report;
  const anyConnected = connected.instagram || connected.tiktok;
  const allConnected = connected.instagram && connected.tiktok;

  return (
    <>
      <header className="topbar">
        <span className="wordmark">Pulse<span className="dot">.</span></span>
        <LogoutButton />
      </header>

      <main className="shell stack">
        <div>
          <h1 className="page-title">Hi, {report.influencer.name.split(" ")[0]}</h1>
          <p className="subtle">How your Instagram and TikTok are actually performing.</p>
          {anyConnected && <SelfRefresh influencerId={id} />}
        </div>

        {searchParams.connected && (
          <div className="notice ok">Connected your {searchParams.connected} account. Your numbers are below.</div>
        )}
        {searchParams.connect === "error" && (
          <div className="notice err">That connection didn’t go through. Try again, or ask the agency for a hand.</div>
        )}

        {anyConnected && <ScoreHero report={report} />}

        {!allConnected && (
          <div className="card card-pad">
            <div className="row-name" style={{ marginBottom: 6 }}>
              {anyConnected ? "Connect your other account" : "Connect your accounts"}
            </div>
            <p className="subtle" style={{ marginTop: 0 }}>
              You’ll be sent to {anyConnected ? "the platform" : "Instagram or TikTok"} to approve access. We only read your public stats.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!connected.instagram && (
                <a className="btn btn-ig" href="/api/connect/instagram/start">Connect Instagram</a>
              )}
              {!connected.tiktok && (
                <a className="btn btn-tt" href="/api/connect/tiktok/start">Connect TikTok</a>
              )}
            </div>
          </div>
        )}

        {connected.instagram && (
          <PlatformCard analysis={report.analysis.instagram} growth={report.growth.instagram} />
        )}
        {connected.tiktok && (
          <PlatformCard analysis={report.analysis.tiktok} growth={report.growth.tiktok} />
        )}

        <AudienceCard audience={report.audience} />
      </main>
    </>
  );
}
