import Link from "next/link";

/**
 * The areas of the dashboard: the numbers, the money and, for the agency
 * alone, the hunt. Links, not tabs, so each area has its own URL and loads
 * only its own data. "hunt" renders only on the agency's own base: this nav
 * is also used on /me/comercial and /admin/[id]/comercial, where a prospect
 * area would be out of place (and, for creators, must not exist at all).
 */
export default function AreaNav({
  base,
  current,
}: {
  base: string;
  current: "performance" | "comercial" | "hunt";
}) {
  const items = [
    { key: "performance", label: "performance", href: base },
    { key: "comercial", label: "comercial", href: `${base}/comercial` },
    ...(base === "/admin" ? [{ key: "hunt", label: "hunt", href: `${base}/hunt` }] : []),
  ];
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
