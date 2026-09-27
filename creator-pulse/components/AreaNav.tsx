import Link from "next/link";

/**
 * The two areas of the dashboard: the numbers and the money. Links, not
 * tabs, so each area has its own URL and loads only its own data.
 */
export default function AreaNav({ base, current }: { base: string; current: "performance" | "comercial" }) {
  const items = [
    { key: "performance", label: "performance", href: base },
    { key: "comercial", label: "comercial", href: `${base}/comercial` },
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
