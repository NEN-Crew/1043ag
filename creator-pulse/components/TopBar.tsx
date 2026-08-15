import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { Grid, Users } from "./Icons";

/**
 * Shared chrome. The Agência segment renders only for staff — but that's
 * cosmetic; the route itself is gated server-side.
 */
export default function TopBar({
  view,
  staff,
}: {
  view: "creator" | "agencia";
  staff?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="topbar-group">
        <span className="wordmark">1043 AG</span>
        <span className="topbar-divider" />
        {staff ? (
          <div className="segbox" role="tablist" aria-label="Visão">
            {/* On the roster there is no creator selected yet, so the Creator
                segment has nowhere to go — inert rather than a dead link. */}
            <span
              role="tab"
              aria-selected={view === "creator"}
              className={`seg${view === "creator" ? " on" : ""}`}
              style={view === "creator" ? undefined : { color: "var(--ink-400)", cursor: "default" }}
              title={view === "creator" ? undefined : "Escolha um creator no ranking"}
            >
              <Users size={13} />
              Creator
            </span>
            <Link
              href="/admin"
              role="tab"
              aria-selected={view === "agencia"}
              className={`seg${view === "agencia" ? " on" : ""}`}
            >
              <Grid size={13} />
              Agência
            </Link>
          </div>
        ) : (
          <span className="status-chip">Creator performance</span>
        )}
      </div>

      <div className="topbar-group">
        <span className="status-chip">Instagram · TikTok</span>
        <LogoutButton />
      </div>
    </header>
  );
}
