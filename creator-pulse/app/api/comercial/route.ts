import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { isAdmin } from "@/lib/auth";
import { listDeals } from "@/lib/deals";
import {
  PAYMENT_LABEL,
  STAGES,
  alerts,
  approvalByBrand,
  derive,
  dueText,
  inPeriod,
  parsePeriod,
  pricingByCreator,
  receivables,
  summarize,
  todayBR,
  type Deal,
} from "@/lib/commercial";
import { formatMoney } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time compare of the bearer token against AIFRED_TOKEN. */
function aifred(req: Request): boolean {
  const want = process.env.AIFRED_TOKEN;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!want || !got) return false;
  const a = Buffer.from(want);
  const b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * GET /api/comercial — the commercial base, read-only, for Aifred (and staff).
 * Auth: `Authorization: Bearer <AIFRED_TOKEN>` or an admin session.
 *
 * Filters, all optional: creator (id or part of the name), marca (part of
 * the brand), etapa (orcamento|contrato|nf|pagamento|recebido|declinado),
 * periodo (mes|30|90|ano|tudo, on the quote date; `recebido` in the summary
 * uses the payment date).
 *
 * Every deal carries its derived stage, due date and a sentence Aifred can
 * repeat as-is; `alertas` is the collection list (late, or due within 5 days).
 */
export async function GET(req: Request) {
  if (!aifred(req) && !isAdmin()) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const url = new URL(req.url);
  const creator = url.searchParams.get("creator");
  const brand = url.searchParams.get("marca");
  const stage = url.searchParams.get("etapa");
  const period = parsePeriod(url.searchParams.get("periodo"));
  const today = todayBR();

  let deals = await listDeals();
  if (creator) deals = deals.filter((d) => d.influencerId === creator || norm(d.creatorName).includes(norm(creator)));
  if (brand) deals = deals.filter((d) => norm(d.brand).includes(norm(brand)));
  const scoped = deals;
  if (stage) deals = deals.filter((d) => derive(d, today).stage === stage);
  const listed = deals.filter((d) => inPeriod(d.receivedAt, period, today));

  const stageLabel = (s: string) => STAGES.find((x) => x.key === s)?.label ?? s;
  const view = (d: Deal) => {
    const x = derive(d, today);
    return {
      id: d.id,
      creator: { id: d.influencerId, name: d.creatorName },
      agencia: d.agency,
      marca: d.brand,
      campanha: d.campaign,
      escopo: d.scope,
      entrega: d.deliverable,
      valor: d.amount,
      valor_nf_creator: Math.round(d.amount * 80) / 100,
      valor_nf_1043: Math.round(d.amount * 20) / 100,
      recebido_em: d.receivedAt,
      prazo_dias_apos_nf: d.paymentTermsDays,
      etapa: x.stage,
      etapa_label: stageLabel(x.stage),
      orcamento: d.quoteStatus,
      contrato: d.contractStatus,
      nf_creator: { status: d.nfCreatorStatus, emitida_em: d.nfCreatorIssuedAt },
      nf_1043: { status: d.nfAgencyStatus, emitida_em: d.nfAgencyIssuedAt },
      pagamento: x.payment,
      pagamento_label: PAYMENT_LABEL[x.payment],
      pagamento_previsto: x.dueDate,
      dias_para_vencer: x.daysToDue,
      pago_em: d.paidAt,
      observacoes: d.notes,
    };
  };

  const sentence = (d: Deal) => {
    const x = derive(d, today);
    return `${d.brand}${d.campaign ? ` (${d.campaign})` : ""} com ${d.creatorName}: ${formatMoney(d.amount)}, ${dueText(x)}${
      x.dueDate ? ` (previsto ${x.dueDate})` : ""
    }.`;
  };

  const s = summarize(scoped, today, period);
  return NextResponse.json({
    hoje: today,
    filtros: { creator, marca: brand, etapa: stage, periodo: period },
    resumo: {
      a_receber: s.receivable,
      a_receber_ate_fim_do_mes: s.dueThisMonth,
      atrasado: s.overdue,
      vence_em_5_dias: s.dueSoon,
      recebido_no_periodo: s.received,
      orcamentos_em_aberto: s.open,
      jobs_ativos: s.active,
    },
    alertas: alerts(scoped, today).map((d) => ({ ...view(d), mensagem: sentence(d) })),
    a_receber: receivables(scoped, today).map(view),
    precificacao: pricingByCreator(scoped),
    aprovacao_por_marca: approvalByBrand(scoped),
    orcamentos: listed.map(view),
  });
}
