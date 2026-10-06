/**
 * The pt-BR copy of the hunt. Pure strings, so the search card (client) and
 * the prospect page (server) say the same thing for the same code.
 */
import type { HuntErrorCode } from "./hunt-source";

const NET: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok" };

export function errorCopy(code: HuntErrorCode | string, ctx: { handle?: string; platform?: string } = {}): string {
  const net = NET[ctx.platform ?? ""] ?? "rede";
  const h = ctx.handle ? `@${ctx.handle}` : "esse perfil";
  switch (code) {
    case "invalid_handle":
      return "Digite um @ ou cole o link do perfil. Letras, números, ponto e sublinhado.";
    case "not_found":
      return `Não encontramos ${h} no ${net}. Confira o @.`;
    case "not_professional":
      return `Não encontramos ${h} como conta profissional. O Instagram só libera dados de contas profissionais (criador ou empresa): perfis pessoais, privados ou restritos por idade não aparecem. Confira o @ também.`;
    case "private":
      return "Conta privada: não há dados públicos.";
    case "suppressed":
      return "Este perfil pediu para não ser analisado. Não buscamos de novo.";
    case "config_missing":
      return `Busca no ${net} ainda não configurada. Veja README › Hunt.`;
    case "token_expired":
      return ctx.platform === "tiktok"
        ? "A chave da ScrapeCreators foi recusada. Confira SCRAPECREATORS_API_KEY (README › Hunt)."
        : "A conexão da 1043 com a API do Instagram expirou. Renove o token (README › Hunt).";
    case "rate_limited":
    case "source_error":
      return "A fonte não respondeu agora. Tente de novo em alguns minutos.";
    case "incomplete":
      return "A fonte devolveu dados incompletos. Mantivemos a última versão salva.";
    default:
      return "Não deu para buscar agora. Tente de novo em alguns minutos.";
  }
}

export const LOADING_COPY = "Buscando dados públicos… leva alguns segundos.";
