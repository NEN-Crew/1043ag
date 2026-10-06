import { isAdmin } from "@/lib/auth";
import { configured, listProfiles } from "@/lib/hunt";
import { rowOf } from "@/lib/hunt-metrics";
import AdminGate from "@/components/AdminGate";
import AreaNav from "@/components/AreaNav";
import TopBar from "@/components/TopBar";
import HuntSearch from "@/components/hunt/HuntSearch";
import HuntList from "@/components/hunt/HuntList";
import { Caption } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Prospects outside the roster. Staff only, enforced here on the server. */
export default async function HuntPage() {
  if (!isAdmin()) return <AdminGate />;

  const profiles = await listProfiles();
  const rows = profiles.map((p) => rowOf(p));
  const inProgress = rows.filter((r) => r.status === "contatado" || r.status === "em_conversa").length;
  const closed = rows.filter((r) => r.status === "fechado").length;

  return (
    <>
      <TopBar
        staff
        identity={{
          name: "1043 agência",
          handle: "hunt",
          stats: [
            { value: String(rows.length), label: "perfis" },
            { value: String(inProgress), label: "em andamento" },
            { value: String(closed), label: "fechados" },
          ],
        }}
      />
      <main className="shell">
        <div className="controls" style={{ paddingBottom: 0 }}>
          <AreaNav base="/admin" current="hunt" />
          <Caption>Perfis de fora do roster, com dados públicos. Só a 1043 vê esta área.</Caption>
        </div>

        <HuntSearch available={{ instagram: configured("instagram"), tiktok: configured("tiktok") }} />

        <HuntList rows={rows} />

        <div className="foot-note">
          <span>1043 AG · hunt</span>
          <span>uso interno</span>
        </div>
      </main>
    </>
  );
}
