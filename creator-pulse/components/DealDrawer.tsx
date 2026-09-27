"use client";
import { useEffect, useRef, useState } from "react";
import {
  CONTRACT_OPTIONS,
  DELIVERABLES,
  NF_OPTIONS,
  PAYMENT_LABEL,
  QUOTE_OPTIONS,
  SPLIT,
  derive,
  dueText,
  formatDay,
  nfIssuedAt,
  type Deal,
  type NfStatus,
} from "@/lib/commercial";
import { formatMoney } from "@/lib/format";
import { Caption, Chip, Seg } from "./ui";
import type { CreatorOption } from "./Commercial";

type Props = {
  /** Null = registering a new orçamento. */
  deal: Deal | null;
  creators: CreatorOption[];
  defaultCreatorId?: string;
  /** On a creator's own tab the creator is fixed. */
  lockCreator: boolean;
  today: string;
  editable: boolean;
  onClose: () => void;
  onPatch: (id: string, p: Partial<Deal>, optimistic?: boolean) => Promise<boolean>;
  onCreate: (p: Partial<Deal>) => Promise<boolean>;
  onDelete: (id: string) => void;
};

type Draft = {
  influencerId: string;
  agency: string;
  brand: string;
  campaign: string;
  scope: string;
  deliverable: string;
  amount: string;
  paymentTermsDays: string;
  receivedAt: string;
  notes: string;
};

const FIELDS: (keyof Draft)[] = [
  "influencerId", "agency", "brand", "campaign", "scope", "deliverable", "amount", "paymentTermsDays", "receivedAt", "notes",
];

function draftOf(d: Deal | null, creatorId: string, today: string): Draft {
  return {
    influencerId: d?.influencerId ?? creatorId,
    agency: d?.agency ?? "",
    brand: d?.brand ?? "",
    campaign: d?.campaign ?? "",
    scope: d?.scope ?? "",
    deliverable: d?.deliverable ?? "",
    amount: d ? String(d.amount).replace(".", ",") : "",
    paymentTermsDays: d?.paymentTermsDays != null ? String(d.paymentTermsDays) : "",
    receivedAt: d?.receivedAt ?? today,
    notes: d?.notes ?? "",
  };
}

/**
 * One publi, opened from the board. The four stages sit on top as a stepper
 * and every status saves the moment it's clicked; the orçamento's own fields
 * sit below and save with a button, because typing shouldn't write.
 */
export default function DealDrawer({
  deal,
  creators,
  defaultCreatorId,
  lockCreator,
  today,
  editable,
  onClose,
  onPatch,
  onCreate,
  onDelete,
}: Props) {
  const creating = !deal;
  const [draft, setDraft] = useState<Draft>(() => draftOf(deal, defaultCreatorId ?? "", today));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const justSaved = useRef(false);

  // After "salvar", read the form back from what the server stored (it
  // normalises money and trims text). A status click elsewhere leaves the
  // form alone, so a half-typed field survives it.
  useEffect(() => {
    if (justSaved.current && deal) {
      justSaved.current = false;
      setDraft(draftOf(deal, "", today));
    }
  }, [deal, today]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const base = draftOf(deal, defaultCreatorId ?? "", today);
  const dirty = FIELDS.filter((k) => draft[k] !== base[k]);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body: Record<string, string> = {};
    for (const k of creating ? FIELDS : dirty) body[k] = draft[k];
    if (!creating) justSaved.current = true;
    const ok = creating ? await onCreate(body as Partial<Deal>) : await onPatch(deal!.id, body as Partial<Deal>, false);
    if (!ok) justSaved.current = false;
    setBusy(false);
  }

  const x = deal ? derive(deal, today) : null;
  const approved = deal?.quoteStatus === "aprovado";
  const creatorName = creators.find((c) => c.id === draft.influencerId)?.name ?? deal?.creatorName ?? "";

  /** Status clicks. Issued/paid dates follow the status unless someone set one. */
  const nf = (who: "Creator" | "Agency", s: NfStatus) => {
    const dateKey = `nf${who}IssuedAt` as const;
    const cur = deal![dateKey];
    onPatch(deal!.id, { [`nf${who}Status`]: s, [dateKey]: s === "aguardando" ? null : cur ?? today } as Partial<Deal>);
  };

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={creating ? "Novo orçamento" : `Orçamento ${deal!.brand}`}>
        <div className="dr-top">
          <span className="caption">
            {creating ? "novo orçamento" : `orçamento recebido em ${formatDay(deal!.receivedAt, today)}`}
          </span>
          <button className="btn sm" onClick={onClose}>
            fechar
          </button>
        </div>

        {!creating && x && (
          <>
            <h2 className="dr-title">{deal!.brand}</h2>
            <p className="dr-sub">
              {[deal!.campaign, deal!.creatorName, deal!.agency && `via ${deal!.agency}`].filter(Boolean).join(" · ")}
            </p>
            <div className="dr-amt">
              <span className="v">{formatMoney(deal!.amount)}</span>
              <span className="caption">
                nf creator {formatMoney(deal!.amount * SPLIT.creator)} (80%) · nf 1043 {formatMoney(deal!.amount * SPLIT.agency)} (20%)
              </span>
            </div>

            {/* ---- stages ---- */}
            <div className="steps">
              <Step n={1} title="orçamento" state={deal!.quoteStatus === "aberto" ? "cur" : deal!.quoteStatus === "aprovado" ? "done" : "off"}>
                {editable ? (
                  <Seg small label="Status do orçamento" value={deal!.quoteStatus} items={QUOTE_OPTIONS}
                    onChange={(k) => onPatch(deal!.id, { quoteStatus: k as Deal["quoteStatus"] })} />
                ) : (
                  <Chip>{QUOTE_OPTIONS.find((o) => o.key === deal!.quoteStatus)!.label}</Chip>
                )}
                {deal!.quoteStatus === "declinado" && <Caption style={{ marginTop: 8 }}>Encerrado. Continua contando na taxa de aprovação.</Caption>}
              </Step>

              <Step n={2} title="contrato" locked={!approved}
                state={!approved ? "off" : deal!.contractStatus === "assinado" ? "done" : x.stage === "contrato" ? "cur" : "off"}>
                {!approved ? (
                  <Caption>Abre quando o orçamento for aprovado.</Caption>
                ) : editable ? (
                  <Seg small label="Status do contrato" value={deal!.contractStatus} items={CONTRACT_OPTIONS}
                    onChange={(k) => onPatch(deal!.id, { contractStatus: k as Deal["contractStatus"] })} />
                ) : (
                  <Chip>{CONTRACT_OPTIONS.find((o) => o.key === deal!.contractStatus)!.label}</Chip>
                )}
              </Step>

              <Step n={3} title="nf" locked={!approved}
                state={!approved ? "off" : deal!.nfCreatorStatus === "enviada" && deal!.nfAgencyStatus === "enviada" ? "done" : x.stage === "nf" ? "cur" : "off"}>
                {!approved ? (
                  <Caption>Abre quando o orçamento for aprovado.</Caption>
                ) : (
                  <div className="nf-rows">
                    {(["Creator", "Agency"] as const).map((who) => {
                      const status = deal![`nf${who}Status`];
                      const issued = deal![`nf${who}IssuedAt`];
                      return (
                        <div key={who} className="nf-row">
                          <div className="nf-label">
                            <b>{who === "Creator" ? "nf do creator" : "nf da 1043"}</b>
                            <span className="caption">
                              {who === "Creator" ? "80%" : "20%"} · {formatMoney(deal!.amount * (who === "Creator" ? SPLIT.creator : SPLIT.agency))}
                            </span>
                          </div>
                          {editable ? (
                            <Seg small label={`Status da nf ${who === "Creator" ? "do creator" : "da 1043"}`} value={status}
                              items={NF_OPTIONS} onChange={(k) => nf(who, k as NfStatus)} />
                          ) : (
                            <Chip>{NF_OPTIONS.find((o) => o.key === status)!.label}</Chip>
                          )}
                          {status !== "aguardando" && (
                            <label className="inline-date">
                              <span className="caption">emitida em</span>
                              {editable ? (
                                <input type="date" className="field-input sm" value={issued ?? ""} max={today}
                                  onChange={(e) => e.target.value && onPatch(deal!.id, { [`nf${who}IssuedAt`]: e.target.value } as Partial<Deal>)} />
                              ) : (
                                <b className="mono">{formatDay(issued, today)}</b>
                              )}
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Step>

              <Step n={4} title="pagamento" locked={!approved} last
                state={!approved ? "off" : deal!.paidAt ? "done" : x.stage === "pagamento" ? "cur" : "off"}>
                {!approved ? (
                  <Caption>Abre quando o orçamento for aprovado.</Caption>
                ) : (
                  <>
                    <div className="pay-due">
                      <div>
                        <span className="caption">data prevista</span>
                        <b className="pay-date">{x.dueDate ? formatDay(x.dueDate, today) : "-"}</b>
                      </div>
                      <Chip tone={x.payment === "atrasado" ? "dark" : x.payment === "recebido" ? "cobalt" : undefined}>
                        {x.dueDate && x.payment !== "recebido" ? dueText(x) : PAYMENT_LABEL[x.payment]}
                      </Chip>
                    </div>
                    <Caption style={{ marginBottom: 12 }}>
                      {deal!.paymentTermsDays == null
                        ? "Defina o prazo do cliente (dias após a nf) nos dados abaixo para calcular a data."
                        : nfIssuedAt(deal!)
                          ? `Primeira nf emitida em ${formatDay(nfIssuedAt(deal!), today)} + ${deal!.paymentTermsDays} dias de prazo.`
                          : `${deal!.paymentTermsDays} dias após a emissão da nf. A data aparece quando a primeira nf for emitida.`}
                    </Caption>
                    {editable ? (
                      <div className="step-row">
                        <Seg small label="Status do pagamento" value={deal!.paidAt ? "recebido" : "aguardando"}
                          items={[
                            { key: "aguardando", label: x.payment === "atrasado" ? "atrasado" : "aguardando pagamento" },
                            { key: "recebido", label: "recebido" },
                          ]}
                          onChange={(k) => onPatch(deal!.id, { paidAt: k === "recebido" ? deal!.paidAt ?? today : null })} />
                        {deal!.paidAt && (
                          <label className="inline-date">
                            <span className="caption">recebido em</span>
                            <input type="date" className="field-input sm" value={deal!.paidAt} max={today}
                              onChange={(e) => e.target.value && onPatch(deal!.id, { paidAt: e.target.value })} />
                          </label>
                        )}
                      </div>
                    ) : deal!.paidAt ? (
                      <Caption>Recebido em <b>{formatDay(deal!.paidAt, today)}</b>.</Caption>
                    ) : null}
                  </>
                )}
              </Step>
            </div>
          </>
        )}

        {/* ---- the orçamento itself ---- */}
        {editable ? (
          <form onSubmit={save} className="dr-form">
            <div className="label-lg" style={{ marginBottom: 14 }}>{creating ? "dados do orçamento" : "dados"}</div>
            <div className="form-grid">
              <div className="full">
                <label className="field-label" htmlFor="o-creator">creator</label>
                {lockCreator ? (
                  <input id="o-creator" className="field-input" value={creatorName} disabled />
                ) : (
                  <select id="o-creator" className="field-input" value={draft.influencerId} onChange={set("influencerId")} required>
                    <option value="" disabled>escolha</option>
                    {creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <Field id="o-brand" label="marca" value={draft.brand} onChange={set("brand")} required />
              <Field id="o-agency" label="agência solicitante" value={draft.agency} onChange={set("agency")} placeholder="se houver" />
              <Field id="o-campaign" label="campanha" value={draft.campaign} onChange={set("campaign")} className="full" />
              <div className="full">
                <label className="field-label" htmlFor="o-scope">escopo do projeto</label>
                <textarea id="o-scope" className="field-input" rows={3} value={draft.scope} onChange={set("scope")}
                  placeholder="ex.: 1 reels + 3 stories, 30 dias de uso de imagem" />
              </div>
              <div>
                <label className="field-label" htmlFor="o-deliv">tipo de entrega</label>
                <input id="o-deliv" className="field-input" list="o-deliv-list" value={draft.deliverable} onChange={set("deliverable")} placeholder="reels, stories…" />
                <datalist id="o-deliv-list">{DELIVERABLES.map((d) => <option key={d} value={d} />)}</datalist>
              </div>
              <Field id="o-amount" label="valor enviado (R$)" value={draft.amount} onChange={set("amount")} inputMode="decimal" placeholder="12.500" required />
              <Field id="o-received" label="data de recebimento" type="date" value={draft.receivedAt} onChange={set("receivedAt")} required />
              <Field id="o-terms" label="prazo de pagamento (dias após a nf)" type="number" min={0} max={365}
                value={draft.paymentTermsDays} onChange={set("paymentTermsDays")} placeholder="30" />
              <div className="full">
                <label className="field-label" htmlFor="o-notes">observações internas</label>
                <textarea id="o-notes" className="field-input" rows={2} value={draft.notes} onChange={set("notes")}
                  placeholder="só a 1043 vê" />
              </div>
            </div>
            <div className="dr-actions">
              {!creating && (
                confirmDelete ? (
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <span className="caption">excluir de vez?</span>
                    <button type="button" className="btn sm solid" onClick={() => onDelete(deal!.id)}>excluir</button>
                    <button type="button" className="btn sm" onClick={() => setConfirmDelete(false)}>cancelar</button>
                  </span>
                ) : (
                  <button type="button" className="btn sm" onClick={() => setConfirmDelete(true)}>excluir orçamento</button>
                )
              )}
              <button className="btn solid" disabled={busy || (!creating && dirty.length === 0)} style={{ marginLeft: "auto" }}>
                {busy ? "salvando…" : creating ? "registrar orçamento" : "salvar dados"}
              </button>
            </div>
          </form>
        ) : (
          deal && (
            <div className="dr-form">
              <div className="label-lg" style={{ marginBottom: 14 }}>dados</div>
              <dl className="dr-dl">
                <dt>marca</dt><dd>{deal.brand}</dd>
                <dt>agência</dt><dd>{deal.agency ?? "-"}</dd>
                <dt>campanha</dt><dd>{deal.campaign ?? "-"}</dd>
                <dt>escopo</dt><dd style={{ whiteSpace: "pre-wrap" }}>{deal.scope ?? "-"}</dd>
                <dt>entrega</dt><dd>{deal.deliverable ?? "-"}</dd>
                <dt>prazo</dt><dd>{deal.paymentTermsDays != null ? `${deal.paymentTermsDays} dias após a nf` : "-"}</dd>
              </dl>
            </div>
          )
        )}
      </aside>
    </>
  );
}

function Step({
  n,
  title,
  state,
  locked,
  last,
  children,
}: {
  n: number;
  title: string;
  state: "done" | "cur" | "off";
  locked?: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`step ${state}${locked ? " locked" : ""}${last ? " last" : ""}`}>
      <span className="step-n">{String(n).padStart(2, "0")}</span>
      <div style={{ minWidth: 0 }}>
        <div className="step-t">{title}</div>
        <div style={{ marginTop: 10 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  className,
  ...rest
}: { id: string; label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} className="field-input" {...rest} />
    </div>
  );
}
