"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ALERT_DAYS,
  PAYMENT_LABEL,
  PERIODS,
  STAGES,
  alerts,
  approvalByBrand,
  derive,
  dueText,
  formatDay,
  inPeriod,
  moveTo,
  pricingByCreator,
  receivables,
  summarize,
  type Deal,
  type Period,
  type Stage,
} from "@/lib/commercial";
import { formatMoney, formatRate } from "@/lib/format";
import { Caption, Chip, SectionHead, Seg } from "./ui";
import { AlertTriangle, ChevronRight, Info } from "./Icons";
import DealDrawer from "./DealDrawer";

export type CreatorOption = { id: string; name: string };

type Props = {
  deals: Deal[];
  creators: CreatorOption[];
  /** Brasília date from the server, so both renders agree on what's late. */
  today: string;
  /**
   * "agency": the whole roster, editable. "creator": one creator's tab as the
   * agency sees it, editable. "self": the creator's own tab, read-only.
   */
  mode: "agency" | "creator" | "self";
  /** The creator whose tab this is (creator / self). */
  creatorId?: string;
};

type StatusFilter = "todos" | "aberto" | "aprovado" | "atrasado" | "vencendo" | "recebido" | "declinado";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "todos", label: "todos os status" },
  { key: "aberto", label: "em aberto" },
  { key: "aprovado", label: "aprovados" },
  { key: "vencendo", label: `vencendo em ${ALERT_DAYS} dias` },
  { key: "atrasado", label: "atrasados" },
  { key: "recebido", label: "recebidos" },
  { key: "declinado", label: "declinados" },
];

const BOARD: Stage[] = ["orcamento", "contrato", "nf", "pagamento", "recebido"];
const stageLabel = (s: Stage) => STAGES.find((x) => x.key === s)!.label;
const norm = (s: string) => s.trim().toLowerCase();

/**
 * The commercial area: every publi from quote to payment, as a board. One
 * component for the three audiences; what changes is whose deals it gets
 * (the page decides, on the server) and whether the cards move.
 */
export default function Commercial({ deals: initial, creators, today, mode, creatorId }: Props) {
  const router = useRouter();
  const editable = mode !== "self";
  const roster = mode === "agency";

  const [deals, setDeals] = useState(initial);
  useEffect(() => setDeals(initial), [initial]);

  const [period, setPeriod] = useState<Period>("tudo");
  const [creator, setCreator] = useState("todos");
  const [brand, setBrand] = useState("todas");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [showDeclined, setShowDeclined] = useState(false);
  const [open, setOpen] = useState<string | "new" | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function fireToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }

  /* ---- writes: optimistic, rolled back on error ---- */

  /** `optimistic: false` for the form, whose raw strings aren't a Deal yet. */
  async function patch(id: string, p: Partial<Deal>, optimistic = true) {
    const before = deals;
    if (optimistic) setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d)));
    const res = await fetch(`/api/deals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }).catch(() => null);
    if (!res?.ok) {
      setDeals(before);
      fireToast((await res?.json().catch(() => null))?.error ?? "Não foi possível salvar");
      return false;
    }
    const { deal } = await res.json();
    setDeals((ds) => ds.map((d) => (d.id === id ? deal : d)));
    router.refresh();
    return true;
  }

  async function create(p: Partial<Deal>) {
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }).catch(() => null);
    if (!res?.ok) {
      fireToast((await res?.json().catch(() => null))?.error ?? "Não foi possível criar");
      return false;
    }
    const { deal } = await res.json();
    setDeals((ds) => [deal, ...ds]);
    setOpen(deal.id);
    fireToast("Orçamento registrado");
    router.refresh();
    return true;
  }

  async function remove(id: string) {
    const res = await fetch(`/api/deals/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return fireToast("Não foi possível excluir");
    setDeals((ds) => ds.filter((d) => d.id !== id));
    setOpen(null);
    fireToast("Orçamento excluído");
    router.refresh();
  }

  function drop(stage: Stage) {
    const d = deals.find((x) => x.id === dragging);
    setDragging(null);
    setOver(null);
    if (!d || derive(d, today).stage === stage) return;
    patch(d.id, moveTo(d, stage, today));
  }

  /* ---- reading ---- */

  const brands = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of deals) m.set(norm(d.brand), d.brand.trim());
    return [...m.values()].sort((a, b) => a.localeCompare(b));
  }, [deals]);

  // Creator and brand scope everything; status and period narrow the board only.
  const scoped = useMemo(
    () =>
      deals.filter(
        (d) => (creator === "todos" || d.influencerId === creator) && (brand === "todas" || norm(d.brand) === norm(brand))
      ),
    [deals, creator, brand]
  );

  const listed = useMemo(
    () =>
      scoped
        .filter((d) => inPeriod(d.receivedAt, period, today))
        .filter((d) => {
          if (status === "todos") return true;
          const x = derive(d, today);
          if (status === "aberto" || status === "aprovado" || status === "declinado") return d.quoteStatus === status;
          if (status === "recebido") return !!d.paidAt;
          return d.quoteStatus === "aprovado" && x.payment === status;
        }),
    [scoped, period, status, today]
  );

  const columns = useMemo(() => {
    const by = new Map<Stage, (Deal & { x: ReturnType<typeof derive> })[]>();
    for (const s of STAGES) by.set(s.key, []);
    for (const d of listed) {
      const x = derive(d, today);
      by.get(x.stage)!.push({ ...d, x });
    }
    // Payment columns read best by due date; the rest newest first.
    for (const s of ["nf", "pagamento"] as Stage[])
      by.get(s)!.sort((a, b) => (a.x.dueDate ?? "9").localeCompare(b.x.dueDate ?? "9"));
    by.get("recebido")!.sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
    return by;
  }, [listed, today]);

  const summary = useMemo(() => summarize(scoped, today, period), [scoped, today, period]);
  const toCollect = useMemo(() => alerts(scoped, today), [scoped, today]);
  const owed = useMemo(() => receivables(scoped, today), [scoped, today]);
  const pricing = useMemo(() => pricingByCreator(scoped), [scoped]);
  const byBrand = useMemo(() => approvalByBrand(scoped), [scoped]);

  const selected = open && open !== "new" ? deals.find((d) => d.id === open) ?? null : null;
  const periodLabel = PERIODS.find((p) => p.key === period)!.label;
  const declined = columns.get("declinado")!;
  const hrefFor = (id: string) => (roster ? `/admin/${id}/comercial` : null);

  return (
    <>
      <div className="controls" style={{ paddingTop: 40 }}>
        <div className="cm-period">
          <Seg label="Período" value={period} onChange={(k) => setPeriod(k as Period)} items={PERIODS} small />
        </div>
        {editable && (
          <button className="btn solid" onClick={() => setOpen("new")}>
            novo orçamento
          </button>
        )}
      </div>

      {/* ---- the money ---- */}
      <div className="score-strip">
        <Money label="a receber" v={summary.receivable.total} n={summary.receivable.count} note="jobs aprovados em aberto" />
        <Money
          label="atrasado"
          v={summary.overdue.total}
          n={summary.overdue.count}
          note={summary.overdue.count ? "passou da data prevista" : "nada vencido"}
        />
        <Money label={`vence em até ${ALERT_DAYS} dias`} v={summary.dueSoon.total} n={summary.dueSoon.count} note={editable ? "hora de cobrar" : "pagamento previsto em breve"} />
        <Money label={`recebido · ${periodLabel}`} v={summary.received.total} n={summary.received.count} note="pela data do pagamento" />
      </div>
      <div className="support" style={{ marginTop: 14 }}>
        <span>
          até o fim do mês <b>{formatMoney(summary.dueThisMonth.total)}</b>
        </span>
        <span>
          orçamentos em aberto <b>{formatMoney(summary.open.total)}</b> · {summary.open.count}
        </span>
        <span>
          jobs ativos <b>{summary.active}</b>
        </span>
      </div>

      {toCollect.length > 0 && (
        <section className="section">
          <SectionHead title={editable ? "cobrar" : "pagamentos em atenção"} />
          <div className="card flush">
            {toCollect.map((d) => (
              <button key={d.id} className="cm-alert" onClick={() => setOpen(d.id)}>
                <span className="cm-alert-icon">
                  <AlertTriangle size={15} />
                </span>
                <span className="cm-alert-body">
                  <b>{d.brand}</b>
                  {d.campaign && <span className="caption"> · {d.campaign}</span>}
                  {roster && <span className="caption"> · {d.creatorName}</span>}
                </span>
                <span className="cm-alert-amt">{formatMoney(d.amount)}</span>
                <span className="cm-alert-due">
                  <Chip tone={d.x.payment === "atrasado" ? "dark" : undefined}>{dueText(d.x)}</Chip>
                  <span className="caption">previsto {formatDay(d.x.dueDate, today)}</span>
                </span>
                <span className="cm-alert-chev">
                  <ChevronRight size={16} />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---- the board ---- */}
      <section className="section">
        <SectionHead title="publis" />
        <div className="cm-filters">
          {roster && (
            <Select label="creator" value={creator} onChange={setCreator}>
              <option value="todos">todos os creators</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <Select label="marca" value={brand} onChange={setBrand}>
            <option value="todas">todas as marcas</option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Select label="status" value={status} onChange={(v) => setStatus(v as StatusFilter)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Caption>
            {listed.length} {listed.length === 1 ? "orçamento" : "orçamentos"}
            {period !== "tudo" && ` recebidos · ${periodLabel}`}
          </Caption>
        </div>

        {deals.length === 0 ? (
          <div className="cm-empty">
            <div className="h3">nenhum orçamento ainda</div>
            <Caption style={{ marginTop: 8, maxWidth: 480 }}>
              {editable
                ? "Registre o primeiro em “novo orçamento”. Cada publi anda por orçamento, contrato, nf e pagamento, e o painel calcula sozinho quando cobrar."
                : "Seus orçamentos aparecem aqui assim que a 1043 registrar o primeiro. Você acompanha cada publi do orçamento ao pagamento, sem precisar procurar no e-mail."}
            </Caption>
          </div>
        ) : (
          <>
            <div className="board">
              {BOARD.map((s) => {
                const list = columns.get(s)!;
                const total = list.reduce((a, d) => a + d.amount, 0);
                return (
                  <div
                    key={s}
                    className={`col${over === s ? " over" : ""}`}
                    onDragOver={editable ? (e) => (e.preventDefault(), setOver(s)) : undefined}
                    onDragLeave={editable ? () => setOver((o) => (o === s ? null : o)) : undefined}
                    onDrop={editable ? (e) => (e.preventDefault(), drop(s)) : undefined}
                  >
                    <div className="col-head">
                      <span className="t">{stageLabel(s)}</span>
                      <span className="n">{list.length}</span>
                    </div>
                    <div className="col-sum">{list.length ? formatMoney(total) : " "}</div>
                    {list.map((d) => (
                      <DealCard
                        key={d.id}
                        d={d}
                        today={today}
                        showCreator={mode === "agency"}
                        draggable={editable}
                        dragging={dragging === d.id}
                        onOpen={() => setOpen(d.id)}
                        onDragStart={() => setDragging(d.id)}
                        onDragEnd={() => (setDragging(null), setOver(null))}
                      />
                    ))}
                    {list.length === 0 && <div className="col-empty">{editable ? "arraste um card para cá" : "nada nesta etapa"}</div>}
                  </div>
                );
              })}
            </div>

            <div
              className={`cm-declined${over === "declinado" ? " over" : ""}`}
              onDragOver={editable ? (e) => (e.preventDefault(), setOver("declinado")) : undefined}
              onDragLeave={editable ? () => setOver((o) => (o === "declinado" ? null : o)) : undefined}
              onDrop={editable ? (e) => (e.preventDefault(), drop("declinado")) : undefined}
            >
              <button className="cm-declined-btn" onClick={() => setShowDeclined((v) => !v)} aria-expanded={showDeclined}>
                <span className="label">declinados · {declined.length}</span>
                <span className="caption">
                  {dragging ? "solte aqui para declinar" : showDeclined ? "esconder" : declined.length ? "mostrar" : ""}
                </span>
              </button>
              {showDeclined && declined.length > 0 && (
                <div className="cm-declined-list">
                  {declined.map((d) => (
                    <DealCard
                      key={d.id}
                      d={d}
                      today={today}
                      showCreator={mode === "agency"}
                      draggable={editable}
                      dragging={dragging === d.id}
                      onOpen={() => setOpen(d.id)}
                      onDragStart={() => setDragging(d.id)}
                      onDragEnd={() => (setDragging(null), setOver(null))}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="chart-note">
              <Info size={13} />
              <Caption>
                {editable
                  ? "Arraste um card entre as colunas ou clique para mudar o status de cada etapa. Contrato, nf e pagamento só abrem para orçamento aprovado. A data prevista é a emissão da primeira nf mais o prazo do cliente; passou dela sem recebimento, vira atrasado sozinho."
                  : "A data prevista de pagamento é a emissão da primeira nf mais o prazo combinado com o cliente. Dúvidas sobre um job, fale com a 1043."}
              </Caption>
            </div>
          </>
        )}
      </section>

      {/* ---- what's owed, by date ---- */}
      {owed.length > 0 && (
        <section className="section">
          <SectionHead title="a receber" />
          <div className="card flush" style={{ overflowX: "auto" }}>
            <table className="cm-table">
              <thead>
                <tr>
                  <th>previsto</th>
                  <th>marca · campanha</th>
                  {mode === "agency" && <th>creator</th>}
                  <th>etapa</th>
                  <th className="r">valor</th>
                  <th className="r">situação</th>
                </tr>
              </thead>
              <tbody>
                {owed.map((d) => (
                  <tr key={d.id} onClick={() => setOpen(d.id)} className="click">
                    <td className="mono">{d.x.dueDate ? formatDay(d.x.dueDate, today) : "-"}</td>
                    <td>
                      <b>{d.brand}</b>
                      {d.campaign && <span className="caption"> · {d.campaign}</span>}
                    </td>
                    {mode === "agency" && <td>{d.creatorName}</td>}
                    <td className="mono">{stageLabel(d.x.stage)}</td>
                    <td className="r money">{formatMoney(d.amount)}</td>
                    <td className="r">
                      <Chip tone={d.x.payment === "atrasado" ? "dark" : undefined}>
                        {d.x.dueDate ? dueText(d.x) : PAYMENT_LABEL[d.x.payment]}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- price base ---- */}
      {deals.length > 0 && (
        <section className="section">
          <SectionHead title="base de precificação" />
          <Caption style={{ padding: "0 10px 16px", maxWidth: 720 }}>
            Só orçamentos aprovados entram na média e na faixa. A taxa de aprovação conta aprovados sobre decididos: orçamentos em aberto
            ainda não contam.
          </Caption>

          {roster ? (
            <div className="card flush" style={{ overflowX: "auto" }}>
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>creator</th>
                    <th className="r">fechados</th>
                    <th className="r">média fechada</th>
                    <th className="r">últimos 5</th>
                    <th className="r">faixa</th>
                    <th className="r">aprovação</th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.map((p) => (
                    <tr key={p.influencerId}>
                      <td>
                        <Link href={hrefFor(p.influencerId)!} className="link-plain">
                          <b>{p.creatorName}</b>
                        </Link>
                      </td>
                      <td className="r mono">
                        {p.approved} / {p.quotes}
                      </td>
                      <td className="r money">{p.closed ? formatMoney(p.closed.avg) : "-"}</td>
                      <td className="r">{p.recentAvg != null ? formatMoney(p.recentAvg) : "-"}</td>
                      <td className="r mono">{p.closed ? `${formatMoney(p.closed.min)} a ${formatMoney(p.closed.max)}` : "-"}</td>
                      <td className="r">{p.approvalRate != null ? `${formatRate(p.approvalRate, 0)}%` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <CreatorPricing p={pricing[0] ?? null} />
          )}

          <div className="two" style={{ marginTop: 24 }}>
            <div className="card">
              <div className="label-lg" style={{ marginBottom: 6 }}>faixa por tipo de entrega</div>
              <Caption>Preenchido quando o orçamento tem o tipo de entrega.</Caption>
              {pricing.some((p) => p.byDeliverable.length) ? (
                <div className="cm-scroll">
                <table className="cm-table compact" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      {roster && <th>creator</th>}
                      <th>entrega</th>
                      <th className="r">jobs</th>
                      <th className="r">faixa</th>
                      <th className="r">média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pricing.flatMap((p) =>
                      p.byDeliverable.map((t) => (
                        <tr key={`${p.influencerId}-${t.deliverable}`}>
                          {roster && <td>{p.creatorName}</td>}
                          <td className="mono">{t.deliverable}</td>
                          <td className="r mono">{t.count}</td>
                          <td className="r mono">
                            {t.min === t.max ? formatMoney(t.min) : `${formatMoney(t.min)} a ${formatMoney(t.max)}`}
                          </td>
                          <td className="r money">{formatMoney(t.avg)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                </div>
              ) : (
                <div className="aud-empty" style={{ marginTop: 12 }}>Nenhum job aprovado com tipo de entrega ainda.</div>
              )}
            </div>

            <div className="card">
              <div className="label-lg" style={{ marginBottom: 6 }}>aprovação por marca</div>
              <Caption>Quantos orçamentos cada marca aprovou, entre os que já tiveram resposta.</Caption>
              <div className="cm-scroll">
              <table className="cm-table compact" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>marca</th>
                    <th className="r">orçamentos</th>
                    <th className="r">aprovação</th>
                    <th className="r">média fechada</th>
                  </tr>
                </thead>
                <tbody>
                  {byBrand.map((b) => (
                    <tr key={b.brand}>
                      <td>
                        <b>{b.brand}</b>
                      </td>
                      <td className="r mono">
                        {b.approved} / {b.quotes}
                      </td>
                      <td className="r">{b.approvalRate != null ? `${formatRate(b.approvalRate, 0)}%` : "-"}</td>
                      <td className="r money">{b.closedAvg != null ? formatMoney(b.closedAvg) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {open && (
        <DealDrawer
          key={open}
          deal={selected}
          creators={creators}
          defaultCreatorId={creatorId ?? (creator !== "todos" ? creator : undefined)}
          lockCreator={mode === "creator"}
          today={today}
          editable={editable}
          onClose={() => setOpen(null)}
          onPatch={patch}
          onCreate={create}
          onDelete={remove}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <i />
          {toast}
        </div>
      )}
    </>
  );
}

function Money({ label, v, n, note }: { label: string; v: number; n: number; note: string }) {
  return (
    <div className="score-cell">
      <span className="l">{label}</span>
      <span className="v cm-money">{formatMoney(v)}</span>
      <span className="n">
        {n} {n === 1 ? "job" : "jobs"} · {note}
      </span>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="cm-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

function stepsOf(d: Deal, stage: Stage): ("done" | "cur" | "")[] {
  const done = [
    d.quoteStatus === "aprovado",
    d.contractStatus === "assinado",
    d.nfCreatorStatus === "enviada" && d.nfAgencyStatus === "enviada",
    !!d.paidAt,
  ];
  const cur = ["orcamento", "contrato", "nf", "pagamento"].indexOf(stage);
  if (stage === "recebido") return ["done", "done", "done", "done"];
  return done.map((ok, i) => (i === cur ? "cur" : ok ? "done" : ""));
}

function DealCard({
  d,
  today,
  showCreator,
  draggable,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  d: Deal & { x: ReturnType<typeof derive> };
  today: string;
  showCreator: boolean;
  draggable: boolean;
  dragging: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { x } = d;
  let foot: React.ReactNode;
  if (x.stage === "orcamento") foot = <span>recebido {formatDay(d.receivedAt, today)}</span>;
  else if (x.stage === "declinado") foot = <span>declinado · {formatDay(d.receivedAt, today)}</span>;
  else if (x.stage === "recebido") foot = <span>recebido em {formatDay(d.paidAt, today)}</span>;
  else if (x.stage === "contrato")
    foot = <Chip>{d.contractStatus === "enviado" ? "contrato enviado" : "aguardando envio"}</Chip>;
  else if (x.stage === "nf")
    foot = (
      <span className="deal-nf">
        <span>creator · {nfShort(d.nfCreatorStatus)}</span>
        <span>1043 · {nfShort(d.nfAgencyStatus)}</span>
      </span>
    );
  else foot = x.dueDate ? <span>previsto {formatDay(x.dueDate, today)}</span> : <span>sem prazo definido</span>;

  const late = x.payment === "atrasado" && d.quoteStatus === "aprovado";
  const soon = x.payment === "vencendo" && d.quoteStatus === "aprovado";

  return (
    <div
      className={`deal${dragging ? " dragging" : ""}${late ? " late" : ""}`}
      role="button"
      tabIndex={0}
      draggable={draggable}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", d.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="deal-top">
        <span className="deal-brand">{d.brand}</span>
        <span className="deal-amt">{formatMoney(d.amount)}</span>
      </div>
      {(d.campaign || d.agency) && (
        <div className="deal-camp">
          {d.campaign}
          {d.campaign && d.agency && " · "}
          {d.agency && <span className="caption">via {d.agency}</span>}
        </div>
      )}
      {showCreator && (
        <div className="deal-who">
          <i>{initials(d.creatorName)}</i>
          {d.creatorName}
        </div>
      )}
      {d.quoteStatus !== "declinado" && (
        <div className="deal-steps" aria-hidden="true">
          {stepsOf(d, x.stage).map((s, i) => (
            <span key={i} className={s} />
          ))}
        </div>
      )}
      <div className="deal-foot">
        {foot}
        {(late || soon) && <Chip tone={late ? "dark" : undefined}>{dueText(x)}</Chip>}
      </div>
    </div>
  );
}

const nfShort = (s: Deal["nfCreatorStatus"]) => (s === "aguardando" ? "aguardando" : s === "emitida" ? "emitida" : "enviada");

function CreatorPricing({ p }: { p: ReturnType<typeof pricingByCreator>[number] | null }) {
  return (
    <div className="score-strip">
      <div className="score-cell">
        <span className="l">média fechada</span>
        <span className="v cm-money">{p?.closed ? formatMoney(p.closed.avg) : "-"}</span>
        <span className="n">{p?.closed ? `${p.closed.count} ${p.closed.count === 1 ? "job aprovado" : "jobs aprovados"}` : "nenhum job aprovado"}</span>
      </div>
      <div className="score-cell">
        <span className="l">últimos 5 jobs</span>
        <span className="v cm-money">{p?.recentAvg != null ? formatMoney(p.recentAvg) : "-"}</span>
        <span className="n">média dos mais recentes</span>
      </div>
      <div className="score-cell">
        <span className="l">faixa fechada</span>
        <span className="v cm-money sm">{p?.closed ? `${formatMoney(p.closed.min)} a ${formatMoney(p.closed.max)}` : "-"}</span>
        <span className="n">menor e maior valor aprovado</span>
      </div>
      <div className="score-cell">
        <span className="l">aprovação</span>
        <span className="v">{p?.approvalRate != null ? `${formatRate(p.approvalRate, 0)}%` : "-"}</span>
        <span className="n">{p ? `${p.approved} aprovados · ${p.declined} declinados` : "sem orçamentos decididos"}</span>
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}
