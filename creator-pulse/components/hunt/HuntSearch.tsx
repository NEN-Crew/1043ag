"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseHandle, platformFromInput } from "@/lib/hunt-handle";
import { LOADING_COPY, errorCopy } from "@/lib/hunt-copy";
import { Caption, Seg, Spinner } from "../ui";
import { PlatformIcon } from "../Icons";

type Net = "instagram" | "tiktok";

/**
 * The search card. A saved copy navigates at once; a new handle shows the
 * spinner for the seconds the fetch takes; a roster handle sends staff to the
 * creator's page instead of paying for public numbers on someone 1043 already
 * represents.
 */
export default function HuntSearch({ available }: { available: Record<Net, boolean> }) {
  const router = useRouter();
  const [net, setNet] = useState<Net>(available.instagram || !available.tiktok ? "instagram" : "tiktok");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<React.ReactNode>(null);
  const ref = useRef<HTMLInputElement>(null);

  // Pasting a link picks the network for you.
  useEffect(() => {
    const p = platformFromInput(input);
    if (p && p !== net) setNet(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    const parsed = parseHandle(input, net);
    if (!parsed) {
      setMsg(errorCopy("invalid_handle"));
      ref.current?.focus();
      return;
    }
    if (!available[parsed.platform]) {
      setMsg(errorCopy("config_missing", { platform: parsed.platform }));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/hunt/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: parsed.platform, input }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(errorCopy("source_error"));
      } else if (d.status === "ok") {
        router.push(d.href);
        return;
      } else if (d.status === "roster") {
        setMsg(
          <>
            @{d.handle} já é creator da 1043 ·{" "}
            <Link href={d.href} className="link" style={{ color: "var(--cobalt)" }}>
              ver no roster
            </Link>
          </>
        );
      } else {
        setMsg(errorCopy(d.code, { handle: d.handle ?? parsed.handle, platform: parsed.platform }));
      }
    } catch {
      setMsg(errorCopy("source_error"));
    }
    setBusy(false);
  }

  const missing = (["instagram", "tiktok"] as Net[]).filter((n) => !available[n]);

  return (
    <section className="section">
      <h3 className="h3" style={{ marginBottom: 14, paddingLeft: 10 }}>buscar perfil</h3>
      <div className="card">
        <form onSubmit={submit} className="hunt-form">
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="field-label" htmlFor="hunt-input">@usuario ou link do perfil</label>
            <input
              id="hunt-input"
              ref={ref}
              className="field-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="@usuario ou https://www.instagram.com/usuario/"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
          </div>
          <Seg
            cobalt
            label="Rede"
            value={net}
            onChange={(k) => setNet(k as Net)}
            items={(["instagram", "tiktok"] as Net[]).map((n) => ({
              key: n,
              label: (
                <>
                  <PlatformIcon platform={n} size={14} />
                  {n}
                </>
              ),
              disabled: !available[n],
              title: available[n] ? undefined : "Ainda não configurado",
            }))}
          />
          <button className="btn solid" disabled={busy || !input.trim()}>
            {busy ? "buscando…" : "buscar"}
          </button>
        </form>

        <div aria-live="polite" style={{ minHeight: 20, marginTop: 12 }}>
          {busy ? (
            <span className="fresh">
              <Spinner small /> {LOADING_COPY}
            </span>
          ) : msg ? (
            <div className="notice" style={{ marginTop: 4 }}>{msg}</div>
          ) : (
            <Caption>
              Dados públicos do perfil e dos últimos posts. Uma busca nova leva alguns segundos; um perfil já buscado abre na
              hora e é guardado por 7 dias.
            </Caption>
          )}
        </div>

        {missing.length > 0 && (
          <Caption style={{ marginTop: 10 }}>
            {missing.map((n) => (n === "instagram" ? "Instagram" : "TikTok")).join(" e ")}{" "}
            {missing.length > 1 ? "indisponíveis" : "indisponível"}: falta{" "}
            {missing
              .map((n) => (n === "instagram" ? "IG_DISCOVERY_TOKEN e IG_DISCOVERY_ACCOUNT_ID" : "SCRAPECREATORS_API_KEY"))
              .join(" e ")}{" "}
            nas variáveis de ambiente. Veja README › Hunt.
          </Caption>
        )}
      </div>
    </section>
  );
}
