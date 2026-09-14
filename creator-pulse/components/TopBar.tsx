import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { formatCount } from "@/lib/format";

export type Identity = {
  name: string;
  handle?: string | null;
  /** Omit entirely to render no photo (the agency); null shows initials. */
  avatarUrl?: string | null;
  /** Three figures on the right of the name, e.g. seguindo · posts · seguidores. */
  stats?: { value: string; label: string }[];
};

/**
 * The dark header from the Figma: logo on the left; name, handle, three
 * figures and the round photo on the right; "sair" at the edge. On the
 * agency screens the identity is the agency itself and the figures are the
 * roster's. `back` adds a bordered link before "sair" (the design's "voltar
 * para os dados").
 */
export default function TopBar({
  identity,
  back,
  staff,
}: {
  identity?: Identity;
  back?: { href: string; label: string };
  staff?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href={staff ? "/admin" : "/me"} className="logo" aria-label="1043 AG">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/1043logo.png" alt="1043 AG" width={148} height={42} />
        </Link>

        <div className="tb-right">
          {identity && (
            <div className="tb-id">
              <div className="tb-name">
                <span className="n">{identity.name.toLowerCase()}</span>
                {identity.handle && <span className="h">@{identity.handle}</span>}
              </div>
              {identity.stats && identity.stats.length > 0 && (
                <div className="tb-stats">
                  {identity.stats.map((s) => (
                    <span key={s.label}>
                      <b>{s.value}</b>
                      {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {identity && identity.avatarUrl !== undefined &&
            (identity.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="tb-avatar" src={identity.avatarUrl} alt="" />
            ) : (
              <div className="tb-avatar" aria-hidden="true">
                {initials(identity.name)}
              </div>
            ))}
          <div className="tb-actions">
            {back && (
              <Link href={back.href} className="btn on-dark">
                {back.label}
              </Link>
            )}
            <LogoutButton />
          </div>
        </div>
      </div>
    </header>
  );
}

/** The three header figures for a creator on the selected network. */
export function creatorStats(v: { following: number | null; postCount: number | null; followers: number | null } | null | undefined) {
  if (!v) return [];
  return [
    { value: formatCount(v.following), label: "seguindo" },
    { value: formatCount(v.postCount), label: "posts" },
    { value: formatCount(v.followers), label: "seguidores" },
  ];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}
