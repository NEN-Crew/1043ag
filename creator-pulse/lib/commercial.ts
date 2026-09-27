/**
 * The commercial area, as pure functions: no database, no React, so the
 * board, the API Aifred reads and the server pages all compute the same
 * stage, due date and totals from the same row.
 *
 * What's stored is only what someone decided (a status, a date). What's
 * derived is everything that follows from it: which column a deal sits in,
 * when the client should pay, whether that's late. A late payment is never a
 * status someone forgot to set; it's a date that passed.
 */

export type QuoteStatus = "aberto" | "aprovado" | "declinado";
export type ContractStatus = "aguardando_envio" | "enviado" | "assinado";
export type NfStatus = "aguardando" | "emitida" | "enviada";

export type Deal = {
  id: string;
  influencerId: string;
  creatorName: string;
  agency: string | null;
  brand: string;
  campaign: string | null;
  scope: string | null;
  deliverable: string | null;
  amount: number;
  /** Days after the invoice is issued, as the client proposed. */
  paymentTermsDays: number | null;
  /** YYYY-MM-DD, like every date here. */
  receivedAt: string;
  quoteStatus: QuoteStatus;
  contractStatus: ContractStatus;
  nfCreatorStatus: NfStatus;
  nfCreatorIssuedAt: string | null;
  nfAgencyStatus: NfStatus;
  nfAgencyIssuedAt: string | null;
  paidAt: string | null;
  /** Agency-only. Stripped before a deal reaches a creator. */
  notes: string | null;
  updatedAt: string;
};

export type Stage = "orcamento" | "contrato" | "nf" | "pagamento" | "recebido" | "declinado";
export type PaymentState = "sem_data" | "aguardando" | "vencendo" | "atrasado" | "recebido";

export const STAGES: { key: Stage; label: string }[] = [
  { key: "orcamento", label: "orçamento" },
  { key: "contrato", label: "contrato" },
  { key: "nf", label: "nf" },
  { key: "pagamento", label: "pagamento" },
  { key: "recebido", label: "recebido" },
  { key: "declinado", label: "declinado" },
];

export const QUOTE_OPTIONS: { key: QuoteStatus; label: string }[] = [
  { key: "aberto", label: "em aberto" },
  { key: "aprovado", label: "aprovado" },
  { key: "declinado", label: "declinado" },
];

export const CONTRACT_OPTIONS: { key: ContractStatus; label: string }[] = [
  { key: "aguardando_envio", label: "aguardando envio" },
  { key: "enviado", label: "enviado" },
  { key: "assinado", label: "assinado" },
];

export const NF_OPTIONS: { key: NfStatus; label: string }[] = [
  { key: "aguardando", label: "aguardando liberação" },
  { key: "emitida", label: "nf emitida" },
  { key: "enviada", label: "nf enviada" },
];

export const PAYMENT_LABEL: Record<PaymentState, string> = {
  sem_data: "aguardando nf",
  aguardando: "aguardando pagamento",
  vencendo: "vence em breve",
  atrasado: "atrasado",
  recebido: "recebido",
};

/** The two invoices of a job. */
export const SPLIT = { creator: 0.8, agency: 0.2 };

/** How close to the due date a payment starts showing up as an alert. */
export const ALERT_DAYS = 5;

/** Common deliverables, offered as suggestions. The field stays free text. */
export const DELIVERABLES = ["reels", "carrossel", "stories", "tiktok", "reels + stories", "pacote", "evento", "ugc"];

/* ---------------------------------------------------------------- dates -- */

const TZ = "America/Sao_Paulo";

/** Today in Brasília, YYYY-MM-DD. The server passes it down so both sides agree. */
export function todayBR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

const toUtc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));

export function addDays(ymd: string, days: number): string {
  return new Date(toUtc(ymd) + days * 86_400_000).toISOString().slice(0, 10);
}

/** b − a, in whole days. */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** "12/10", or "12/10/25" when it's not this year. */
export function formatDay(ymd: string | null | undefined, today?: string): string {
  if (!ymd) return "-";
  const [y, m, d] = ymd.split("-");
  return today && today.slice(0, 4) === y ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

export type Period = "tudo" | "mes" | "30" | "90" | "ano";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "mes", label: "este mês" },
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "ano", label: "este ano" },
  { key: "tudo", label: "tudo" },
];

export function parsePeriod(v: string | null | undefined): Period {
  return PERIODS.some((p) => p.key === v) ? (v as Period) : "tudo";
}

export function inPeriod(ymd: string | null | undefined, period: Period, today: string): boolean {
  if (!ymd) return false;
  if (period === "tudo") return true;
  if (period === "mes") return ymd.slice(0, 7) === today.slice(0, 7);
  if (period === "ano") return ymd.slice(0, 4) === today.slice(0, 4);
  const d = daysBetween(ymd, today);
  return d >= 0 && d < Number(period);
}

/* ------------------------------------------------------------- deriving -- */

export type Derived = {
  stage: Stage;
  /** The first invoice's issue date + the client's terms. Null until both exist. */
  dueDate: string | null;
  /** Negative once it's late. */
  daysToDue: number | null;
  payment: PaymentState;
};

/**
 * Where a deal sits is the first stage that isn't finished. A payment marked
 * received wins over everything after approval: the money arrived, whatever
 * the paperwork says.
 */
export function stageOf(d: Deal): Stage {
  if (d.quoteStatus === "declinado") return "declinado";
  if (d.quoteStatus === "aberto") return "orcamento";
  if (d.paidAt) return "recebido";
  if (d.contractStatus !== "assinado") return "contrato";
  if (d.nfCreatorStatus !== "enviada" || d.nfAgencyStatus !== "enviada") return "nf";
  return "pagamento";
}

/** The client's clock starts at the first invoice issued. */
export function nfIssuedAt(d: Deal): string | null {
  const dates = [
    d.nfCreatorStatus !== "aguardando" ? d.nfCreatorIssuedAt : null,
    d.nfAgencyStatus !== "aguardando" ? d.nfAgencyIssuedAt : null,
  ].filter((x): x is string => !!x);
  return dates.length ? dates.sort()[0] : null;
}

export function derive(d: Deal, today: string): Derived {
  const stage = stageOf(d);
  const issued = nfIssuedAt(d);
  const dueDate = issued && d.paymentTermsDays != null ? addDays(issued, d.paymentTermsDays) : null;
  const daysToDue = dueDate ? daysBetween(today, dueDate) : null;
  let payment: PaymentState;
  if (d.paidAt) payment = "recebido";
  else if (daysToDue == null) payment = "sem_data";
  else if (daysToDue < 0) payment = "atrasado";
  else if (daysToDue <= ALERT_DAYS) payment = "vencendo";
  else payment = "aguardando";
  return { stage, dueDate, daysToDue, payment };
}

/** Is money owed on this deal? Approved and not yet received. */
export const isReceivable = (d: Deal) => d.quoteStatus === "aprovado" && !d.paidAt;

/** "vence hoje" · "vence em 3 dias" · "atrasado há 2 dias" */
export function dueText(x: Derived): string {
  if (x.payment === "recebido") return "recebido";
  if (x.daysToDue == null) return "sem data prevista";
  if (x.daysToDue === 0) return "vence hoje";
  if (x.daysToDue > 0) return `vence em ${x.daysToDue} ${x.daysToDue === 1 ? "dia" : "dias"}`;
  const late = -x.daysToDue;
  return `atrasado há ${late} ${late === 1 ? "dia" : "dias"}`;
}

/* ---------------------------------------------------------------- moves -- */

/**
 * What dropping a card on a column changes. Moving forward finishes the
 * stages in between; moving back reopens only the target stage and keeps the
 * rest of the paperwork, except a payment, which can't stand once the deal
 * is back before "recebido".
 */
export function moveTo(d: Deal, stage: Stage, today: string): Partial<Deal> {
  const approved = { quoteStatus: "aprovado" as const };
  const signed = { contractStatus: "assinado" as const };
  switch (stage) {
    case "orcamento":
      return { quoteStatus: "aberto" };
    case "declinado":
      return { quoteStatus: "declinado" };
    case "contrato":
      return {
        ...approved,
        paidAt: null,
        contractStatus: d.contractStatus === "assinado" ? "enviado" : d.contractStatus,
      };
    case "nf": {
      const bothSent = d.nfCreatorStatus === "enviada" && d.nfAgencyStatus === "enviada";
      return {
        ...approved,
        ...signed,
        paidAt: null,
        ...(bothSent ? { nfCreatorStatus: "emitida" as const, nfAgencyStatus: "emitida" as const } : {}),
      };
    }
    case "pagamento":
      return {
        ...approved,
        ...signed,
        paidAt: null,
        nfCreatorStatus: "enviada",
        nfCreatorIssuedAt: d.nfCreatorIssuedAt ?? today,
        nfAgencyStatus: "enviada",
        nfAgencyIssuedAt: d.nfAgencyIssuedAt ?? today,
      };
    case "recebido":
      return { ...approved, paidAt: d.paidAt ?? today };
  }
}

/* -------------------------------------------------------------- summary -- */

export type Summary = {
  /** Everything approved and not yet received. */
  receivable: { total: number; count: number };
  overdue: { total: number; count: number };
  dueSoon: { total: number; count: number };
  /** Receivable with the due date in the current month (late ones included). */
  dueThisMonth: { total: number; count: number };
  received: { total: number; count: number };
  /** Quotes still open: money on the table, not money owed. */
  open: { total: number; count: number };
  /** Approved, not yet received: the jobs in motion. */
  active: number;
};

const add = (acc: { total: number; count: number }, n: number) => {
  acc.total += n;
  acc.count += 1;
};

/** `received` is filtered by payment date; everything else is outstanding, whenever it started. */
export function summarize(deals: Deal[], today: string, period: Period = "tudo"): Summary {
  const s: Summary = {
    receivable: { total: 0, count: 0 },
    overdue: { total: 0, count: 0 },
    dueSoon: { total: 0, count: 0 },
    dueThisMonth: { total: 0, count: 0 },
    received: { total: 0, count: 0 },
    open: { total: 0, count: 0 },
    active: 0,
  };
  for (const d of deals) {
    if (d.quoteStatus === "aberto") add(s.open, d.amount);
    if (d.paidAt && inPeriod(d.paidAt, period, today)) add(s.received, d.amount);
    if (!isReceivable(d)) continue;
    const x = derive(d, today);
    s.active += 1;
    add(s.receivable, d.amount);
    if (x.payment === "atrasado") add(s.overdue, d.amount);
    if (x.payment === "vencendo") add(s.dueSoon, d.amount);
    if (x.dueDate && x.dueDate.slice(0, 7) <= today.slice(0, 7)) add(s.dueThisMonth, d.amount);
  }
  return s;
}

/** Owed money, soonest first. Deals with no date yet go last, oldest quote first. */
export function receivables(deals: Deal[], today: string): (Deal & { x: Derived })[] {
  return deals
    .filter(isReceivable)
    .map((d) => ({ ...d, x: derive(d, today) }))
    .sort((a, b) => {
      if (a.x.dueDate && b.x.dueDate) return a.x.dueDate.localeCompare(b.x.dueDate);
      if (a.x.dueDate) return -1;
      if (b.x.dueDate) return 1;
      return a.receivedAt.localeCompare(b.receivedAt);
    });
}

/** Late or due within ALERT_DAYS. The list Aifred reminds from. */
export function alerts(deals: Deal[], today: string) {
  return receivables(deals, today).filter((d) => d.x.payment === "atrasado" || d.x.payment === "vencendo");
}

/* -------------------------------------------------------------- pricing -- */

export type Range = { count: number; avg: number; min: number; max: number };

function range(values: number[]): Range | null {
  if (!values.length) return null;
  return {
    count: values.length,
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export type Pricing = {
  influencerId: string;
  creatorName: string;
  quotes: number;
  approved: number;
  declined: number;
  /** approved ÷ (approved + declined). Open quotes haven't been decided, so they don't count. */
  approvalRate: number | null;
  closed: Range | null;
  /** Average of the five most recent approved jobs, by quote date. */
  recentAvg: number | null;
  byDeliverable: ({ deliverable: string } & Range)[];
};

/** A price base built only from what actually closed. */
export function pricingByCreator(deals: Deal[]): Pricing[] {
  const groups = new Map<string, Deal[]>();
  for (const d of deals) groups.set(d.influencerId, [...(groups.get(d.influencerId) ?? []), d]);

  return [...groups.values()]
    .map((list) => {
      const approved = list.filter((d) => d.quoteStatus === "aprovado");
      const declined = list.filter((d) => d.quoteStatus === "declinado").length;
      const decided = approved.length + declined;
      const recent = [...approved].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 5);
      const byType = new Map<string, number[]>();
      for (const d of approved) {
        const k = d.deliverable?.trim().toLowerCase();
        if (k) byType.set(k, [...(byType.get(k) ?? []), d.amount]);
      }
      return {
        influencerId: list[0].influencerId,
        creatorName: list[0].creatorName,
        quotes: list.length,
        approved: approved.length,
        declined,
        approvalRate: decided ? (approved.length / decided) * 100 : null,
        closed: range(approved.map((d) => d.amount)),
        recentAvg: recent.length ? recent.reduce((a, d) => a + d.amount, 0) / recent.length : null,
        byDeliverable: [...byType.entries()]
          .map(([deliverable, v]) => ({ deliverable, ...range(v)! }))
          .sort((a, b) => b.count - a.count || b.avg - a.avg),
      };
    })
    .sort((a, b) => (b.closed?.avg ?? -1) - (a.closed?.avg ?? -1));
}

export type BrandRate = {
  brand: string;
  quotes: number;
  approved: number;
  declined: number;
  approvalRate: number | null;
  closedAvg: number | null;
};

export function approvalByBrand(deals: Deal[]): BrandRate[] {
  const groups = new Map<string, { name: string; list: Deal[] }>();
  for (const d of deals) {
    const k = d.brand.trim().toLowerCase();
    const g = groups.get(k) ?? { name: d.brand.trim(), list: [] };
    g.list.push(d);
    groups.set(k, g);
  }
  return [...groups.values()]
    .map(({ name, list }) => {
      const approved = list.filter((d) => d.quoteStatus === "aprovado");
      const declined = list.filter((d) => d.quoteStatus === "declinado").length;
      const decided = approved.length + declined;
      return {
        brand: name,
        quotes: list.length,
        approved: approved.length,
        declined,
        approvalRate: decided ? (approved.length / decided) * 100 : null,
        closedAvg: approved.length ? approved.reduce((a, d) => a + d.amount, 0) / approved.length : null,
      };
    })
    .sort((a, b) => b.quotes - a.quotes || a.brand.localeCompare(b.brand));
}

/** A creator never sees the agency's internal notes. */
export function forCreatorDeals(deals: Deal[]): Deal[] {
  return deals.map((d) => ({ ...d, notes: null }));
}
