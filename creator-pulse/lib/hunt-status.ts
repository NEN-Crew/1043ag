/**
 * Vocabulary shared by server and client code. lib/hunt.ts and
 * lib/hunt-metrics.ts pull in the DB driver, so client components import
 * from here instead.
 */

/** Prospects post less regularly than the roster; 90 days gives steadier medians. */
export const HUNT_DEFAULT_WINDOW = 90;

export const HUNT_STATUSES = ["encontrado", "contatado", "em_conversa", "fechado", "descartado"] as const;
export type HuntStatus = (typeof HUNT_STATUSES)[number];
export const STATUS_LABEL: Record<HuntStatus, string> = {
  encontrado: "encontrado",
  contatado: "contatado",
  em_conversa: "em conversa",
  fechado: "fechado",
  descartado: "descartado",
};
export const DELETE_REASONS = ["pedido_do_perfil", "menor_de_idade", "sem_interesse"] as const;
export type DeleteReason = (typeof DELETE_REASONS)[number];
export const DELETE_REASON_LABEL: Record<DeleteReason, string> = {
  pedido_do_perfil: "o perfil pediu para não ser analisado",
  menor_de_idade: "é menor de idade",
  sem_interesse: "não interessa mais",
};
