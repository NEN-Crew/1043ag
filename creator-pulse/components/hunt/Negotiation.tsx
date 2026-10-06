"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Prospect } from "@/lib/hunt-metrics";
import { DELETE_REASONS, DELETE_REASON_LABEL, DeleteReason, HUNT_STATUSES, HuntStatus, STATUS_LABEL } from "@/lib/hunt-status";
import { formatMoney, formatNumber } from "@/lib/format";
import { Caption, Chip, SectionHead, Seg } from "../ui";

/**
 * Everything staff type about a prospect: status, contact, notes, the price
 * references, the "create creator access" form and the delete dialog. Saves
 * on change and says "salvo", so nothing here has a submit button to forget.
 */
export default function Negotiation({ prospect: p }: { prospect: Prospect }) {
  const router = useRouter();
  const [status, setStatus] = useState<HuntStatus>(p.status);
  const [contact, setContact] = useState(p.contact ?? "");
  const [notes, setNotes] = useState(p.notes ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function save(patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/hunt/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setSaved("salvo");
      setTimeout(() => setSaved(null), 1800);
    } else setError("Não deu para salvar. Tente de novo.");
  }

  function changeStatus(k: string) {
    setStatus(k as HuntStatus);
    save({ status: k });
  }

  // Text fields save a moment after typing stops, and on blur.
  function queue(patch: Record<string, unknown>) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(patch), 700);
  }
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <section className="section">
      <SectionHead title="negociação" right={saved ? <Chip tone="cobalt">{saved}</Chip> : undefined} />
      <div className="card">
        <div className="hunt-neg">
          <div className="hunt-neg-main">
            <div>
              <span className="field-label">status</span>
              <Seg label="Status" value={status} onChange={changeStatus} items={HUNT_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s] }))} />
            </div>
            <div>
              <label className="field-label" htmlFor="hunt-contact">contato</label>
              <input
                id="hunt-contact"
                className="field-input"
                placeholder="e-mail ou WhatsApp"
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  queue({ contact: e.target.value });
                }}
                onBlur={() => save({ contact })}
              />
              <Caption style={{ marginTop: 6 }}>digitado pela equipe, nunca coletado</Caption>
            </div>
            <div>
              <label className="field-label" htmlFor="hunt-notes">notas internas</label>
              <textarea
                id="hunt-notes"
                className="field-input"
                rows={4}
                style={{ resize: "vertical", lineHeight: 1.45 }}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  queue({ notes: e.target.value });
                }}
                onBlur={() => save({ notes })}
              />
            </div>
            {error && <div className="notice warn" role="alert">{error}</div>}
          </div>

          <div className="hunt-neg-side">
            <PriceRefs p={p} />
            <VerifiedData p={p} onLinked={() => router.refresh()} />
            <DeleteData p={p} />
          </div>
        </div>
      </div>
    </section>
  );
}

function PriceRefs({ p }: { p: Prospect }) {
  const mv = p.price.mediaValue;
  const c = p.price.closed;
  return (
    <div>
      <span className="field-label">referências de preço</span>
      <div className="hunt-refs">
        <div>
          <b>{mv ? `${mv.currency} ${formatNumber(mv.low)} a ${formatNumber(mv.high)}` : "—"}</b>
          <span className="caption">valor / post pelas views públicas</span>
        </div>
        {c && (
          <div>
            <b>{formatMoney(c.median)}</b>
            <span className="caption">
              mediana fechada por creators da 1043 na faixa {p.tier.name} · {c.jobs} {c.jobs === 1 ? "job" : "jobs"} ·{" "}
              {c.creators} {c.creators === 1 ? "creator" : "creators"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Reach, saves and audience need consent. The existing creator-account flow
 * provides it: a login is created here, the person connects at /me, and the
 * official numbers show up in the roster. The one-time password is shown the
 * way CreateInfluencer shows it.
 */
function VerifiedData({ p, onLinked }: { p: Prospect; onLinked: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(p.displayName ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<null | { email: string; password: string; loginUrl: string }>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/influencers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error === "Email already in use" ? "Esse e-mail já tem conta." : d.error ?? "Não foi possível criar");
      setBusy(false);
      return;
    }
    await fetch(`/api/hunt/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ influencerId: d.id }),
    });
    setCreated(d);
    setBusy(false);
    onLinked();
  }

  return (
    <div>
      <span className="field-label">dados verificados</span>
      <Caption>
        Alcance, salvos e audiência só com a conta conectada. Crie um acesso de creator: quando o perfil conectar, os números
        oficiais aparecem no roster.
      </Caption>
      {p.linked ? (
        <Caption style={{ marginTop: 8 }}>
          Acesso criado para <b>{p.linked.name}</b>
          {p.linked.connected ? (
            <>
              {" "}· <Link href={`/admin/${p.linked.influencerId}?rede=${p.platform}`} className="link">ver dados verificados</Link>
            </>
          ) : (
            " · aguardando a conexão da conta"
          )}
        </Caption>
      ) : created ? (
        <div className="notice good" style={{ marginTop: 10 }}>
          <span className="micro" style={{ color: "var(--cobalt)" }}>conta criada</span>
          Envie estes dados ao creator. A senha aparece uma única vez.
          <div className="mono" style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 13, color: "var(--ink)" }}>
            <span>e-mail: <b>{created.email}</b></span>
            <span>senha: <b>{created.password}</b></span>
            <span>login: <b>{created.loginUrl}</b></span>
          </div>
        </div>
      ) : !open ? (
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
          criar acesso de creator
        </button>
      ) : (
        <form onSubmit={submit} style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <div>
            <label className="field-label" htmlFor="hunt-new-name">nome</label>
            <input id="hunt-new-name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="field-label" htmlFor="hunt-new-email">e-mail</label>
            <input id="hunt-new-email" className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {error && <div className="notice warn" role="alert">{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn solid sm" disabled={busy}>{busy ? "criando…" : "criar conta"}</button>
            <button type="button" className="btn sm" onClick={() => setOpen(false)}>cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}

function DeleteData({ p }: { p: Prospect }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<DeleteReason>("sem_interesse");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/hunt/${p.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) router.push("/admin/hunt");
    else {
      setError("Não deu para excluir. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="field-label">excluir dados</span>
      <button className="btn sm" onClick={() => setOpen(true)}>excluir dados deste perfil</button>
      {open && (
        <>
          <div className="drawer-bg" onClick={() => !busy && setOpen(false)} />
          <div className="hunt-dialog" role="dialog" aria-modal="true" aria-labelledby="hunt-del-title">
            <h3 className="h3" id="hunt-del-title">excluir @{p.handle}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--ink-600)", margin: "10px 0 16px" }}>
              Apaga tudo o que guardamos deste perfil. Nos dois primeiros casos, ele não pode ser buscado de novo.
            </p>
            <div role="radiogroup" aria-label="Motivo" style={{ display: "grid", gap: 8 }}>
              {DELETE_REASONS.map((r) => (
                <label key={r} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                  <input type="radio" name="hunt-del-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                  {DELETE_REASON_LABEL[r]}
                </label>
              ))}
            </div>
            {error && <div className="notice warn" role="alert" style={{ marginTop: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button className="btn solid sm" onClick={confirm} disabled={busy}>{busy ? "excluindo…" : "excluir"}</button>
              <button className="btn sm" onClick={() => setOpen(false)} disabled={busy}>cancelar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
