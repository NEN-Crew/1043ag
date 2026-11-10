import Link from "next/link";

/**
 * The two areas of the dashboard: the numbers and the money. Links, not
 * tabs, so each area has its own URL and loads only its own data.
 *
 * The commercial area is hidden on the creator side for now (`/me`): the
 * page still exists, it just isn't linked and redirects to performance.
 */
export const CREATOR_COMERCIAL_HIDDEN = true;

export default function AreaNav({ base, current }: { base: string; current: "performance" | "comercial" }) {
  const hideComercial = CREATOR_COMERCIAL_HIDDEN && base === "/me";
  const items = [
    { key: "performance", label: "performance", href: base },
    ...(hideComercial ? [] : [{ key: "comercial", label: "comercial", href: `${base}/comercial` }]),
  ];
  if (items.length < 2) return null;
  return (
    <nav className="seg" aria-label="Área">
      {items.map((it) => (
        <Link key={it.key} href={it.href} aria-current={current === it.key ? "true" : undefined}>
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
