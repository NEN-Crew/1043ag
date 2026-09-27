import crypto from "node:crypto";
import { sql } from "./db";
import type { ContractStatus, Deal, NfStatus, QuoteStatus } from "./commercial";

/**
 * The deals table. Dates come back as text (YYYY-MM-DD) and money as a
 * float: the driver would otherwise hand back a Date at local midnight and a
 * numeric string, and both have bitten this codebase before.
 */

const SELECT = `select
  d.id, d.influencer_id, i.name as creator_name, d.agency, d.brand, d.campaign, d.scope, d.deliverable,
  d.amount::float8 as amount, d.payment_terms_days, d.received_at::text as received_at,
  d.quote_status, d.contract_status,
  d.nf_creator_status, d.nf_creator_issued_at::text as nf_creator_issued_at,
  d.nf_agency_status, d.nf_agency_issued_at::text as nf_agency_issued_at,
  d.paid_at::text as paid_at, d.notes, d.updated_at
  from deals d join influencers i on i.id = d.influencer_id`;
const ORDER = "order by d.received_at desc, d.created_at desc";

function fromRow(r: any): Deal {
  return {
    id: r.id,
    influencerId: r.influencer_id,
    creatorName: r.creator_name,
    agency: r.agency,
    brand: r.brand,
    campaign: r.campaign,
    scope: r.scope,
    deliverable: r.deliverable,
    amount: Number(r.amount),
    paymentTermsDays: r.payment_terms_days == null ? null : Number(r.payment_terms_days),
    receivedAt: r.received_at,
    quoteStatus: r.quote_status,
    contractStatus: r.contract_status,
    nfCreatorStatus: r.nf_creator_status,
    nfCreatorIssuedAt: r.nf_creator_issued_at,
    nfAgencyStatus: r.nf_agency_status,
    nfAgencyIssuedAt: r.nf_agency_issued_at,
    paidAt: r.paid_at,
    notes: r.notes,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/** Every deal, or one creator's. Newest quote first. */
export async function listDeals(influencerId?: string): Promise<Deal[]> {
  const rows = influencerId
    ? await sql(`${SELECT} where d.influencer_id = $1 ${ORDER}`, [influencerId])
    : await sql(`${SELECT} ${ORDER}`);
  return (rows as any[]).map(fromRow);
}

export async function getDeal(id: string): Promise<Deal | null> {
  const rows = await sql(`${SELECT} where d.id = $1`, [id]);
  return rows[0] ? fromRow(rows[0]) : null;
}

/* ------------------------------------------------------------ validation -- */

const QUOTE: QuoteStatus[] = ["aberto", "aprovado", "declinado"];
const CONTRACT: ContractStatus[] = ["aguardando_envio", "enviado", "assinado"];
const NF: NfStatus[] = ["aguardando", "emitida", "enviada"];

export class BadInput extends Error {}

const text = (v: unknown, max = 500): string | null => {
  if (v == null) return null;
  const s = String(v).trim().slice(0, max);
  return s.length ? s : null;
};

const date = (v: unknown, field: string): string | null => {
  if (v == null || v === "") return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new BadInput(`${field}: data inválida`);
  return s;
};

const oneOf = <T extends string>(v: unknown, allowed: T[], field: string): T => {
  if (!allowed.includes(v as T)) throw new BadInput(`${field}: valor inválido`);
  return v as T;
};

/**
 * Accepts "12500", "12.500" (pt-BR thousands, not twelve and a half),
 * "12.500,50", "R$ 12.500" and 12500.5. A lone dot followed by one or two
 * digits ("12500.5") is still read as decimals.
 */
function money(v: unknown): number {
  let n: number;
  if (typeof v === "number") n = v;
  else {
    const s = String(v ?? "").replace(/[^\d.,-]/g, "");
    if (s.includes(",")) n = Number(s.replace(/\./g, "").replace(",", "."));
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) n = Number(s.replace(/\./g, ""));
    else n = Number(s);
  }
  if (!Number.isFinite(n) || n < 0 || n > 1e10) throw new BadInput("valor inválido");
  return Math.round(n * 100) / 100;
}

function days(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 365) throw new BadInput("prazo: use dias entre 0 e 365");
  return n;
}

type Patch = Partial<Omit<Deal, "id" | "creatorName" | "updatedAt">>;

/** Only known keys, each checked. Unknown keys are ignored. */
export function cleanPatch(body: Record<string, unknown>): Patch {
  const p: Patch = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  if (has("influencerId")) p.influencerId = String(body.influencerId);
  if (has("agency")) p.agency = text(body.agency, 120);
  if (has("brand")) {
    const b = text(body.brand, 120);
    if (!b) throw new BadInput("marca é obrigatória");
    p.brand = b;
  }
  if (has("campaign")) p.campaign = text(body.campaign, 160);
  if (has("scope")) p.scope = text(body.scope, 2000);
  if (has("deliverable")) p.deliverable = text(body.deliverable, 60)?.toLowerCase() ?? null;
  if (has("amount")) p.amount = money(body.amount);
  if (has("paymentTermsDays")) p.paymentTermsDays = days(body.paymentTermsDays);
  if (has("receivedAt")) {
    const d = date(body.receivedAt, "data de recebimento");
    if (!d) throw new BadInput("data de recebimento é obrigatória");
    p.receivedAt = d;
  }
  if (has("quoteStatus")) p.quoteStatus = oneOf(body.quoteStatus, QUOTE, "orçamento");
  if (has("contractStatus")) p.contractStatus = oneOf(body.contractStatus, CONTRACT, "contrato");
  if (has("nfCreatorStatus")) p.nfCreatorStatus = oneOf(body.nfCreatorStatus, NF, "nf creator");
  if (has("nfCreatorIssuedAt")) p.nfCreatorIssuedAt = date(body.nfCreatorIssuedAt, "emissão nf creator");
  if (has("nfAgencyStatus")) p.nfAgencyStatus = oneOf(body.nfAgencyStatus, NF, "nf 1043");
  if (has("nfAgencyIssuedAt")) p.nfAgencyIssuedAt = date(body.nfAgencyIssuedAt, "emissão nf 1043");
  if (has("paidAt")) p.paidAt = date(body.paidAt, "data do pagamento");
  if (has("notes")) p.notes = text(body.notes, 2000);
  return p;
}

/* ---------------------------------------------------------------- writes -- */

export async function createDeal(p: Patch, createdBy: string | null): Promise<Deal> {
  if (!p.influencerId) throw new BadInput("escolha o creator");
  if (!p.brand) throw new BadInput("marca é obrigatória");
  if (p.amount == null) throw new BadInput("valor é obrigatório");
  if (!p.receivedAt) throw new BadInput("data de recebimento é obrigatória");
  const exists = (await sql`select 1 from influencers where id = ${p.influencerId}`)[0];
  if (!exists) throw new BadInput("creator não encontrado");

  const id = `orc-${crypto.randomBytes(5).toString("hex")}`;
  await sql`
    insert into deals (id, influencer_id, agency, brand, campaign, scope, deliverable, amount,
                       payment_terms_days, received_at, quote_status, notes, created_by)
    values (${id}, ${p.influencerId}, ${p.agency ?? null}, ${p.brand}, ${p.campaign ?? null}, ${p.scope ?? null},
            ${p.deliverable ?? null}, ${p.amount}, ${p.paymentTermsDays ?? null}, ${p.receivedAt},
            ${p.quoteStatus ?? "aberto"}, ${p.notes ?? null}, ${createdBy})`;
  return (await getDeal(id))!;
}

/**
 * One column at a time would be simpler to read but N round trips per click;
 * instead the merged row is written back whole. The patch was validated,
 * the rest came from the database.
 */
export async function updateDeal(id: string, p: Patch): Promise<Deal | null> {
  const cur = await getDeal(id);
  if (!cur) return null;
  if (p.influencerId && p.influencerId !== cur.influencerId) {
    const exists = (await sql`select 1 from influencers where id = ${p.influencerId}`)[0];
    if (!exists) throw new BadInput("creator não encontrado");
  }
  const d = { ...cur, ...p };
  await sql`
    update deals set
      influencer_id = ${d.influencerId}, agency = ${d.agency}, brand = ${d.brand}, campaign = ${d.campaign},
      scope = ${d.scope}, deliverable = ${d.deliverable}, amount = ${d.amount},
      payment_terms_days = ${d.paymentTermsDays}, received_at = ${d.receivedAt},
      quote_status = ${d.quoteStatus}, contract_status = ${d.contractStatus},
      nf_creator_status = ${d.nfCreatorStatus}, nf_creator_issued_at = ${d.nfCreatorIssuedAt},
      nf_agency_status = ${d.nfAgencyStatus}, nf_agency_issued_at = ${d.nfAgencyIssuedAt},
      paid_at = ${d.paidAt}, notes = ${d.notes}, updated_at = now()
    where id = ${id}`;
  return getDeal(id);
}

export async function deleteDeal(id: string): Promise<boolean> {
  const rows = await sql`delete from deals where id = ${id} returning id`;
  return rows.length > 0;
}

/** The roster, for the creator picker and filter. */
export async function listCreators(): Promise<{ id: string; name: string }[]> {
  const rows = await sql`select id, name from influencers order by lower(name)`;
  return (rows as any[]).map((r) => ({ id: r.id, name: r.name }));
}
