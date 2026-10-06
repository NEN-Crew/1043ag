/**
 * The betting-advertising scan for prospects. Everything a reviewer might
 * want to change lives in this file: the operators, the context words, and
 * the date the law changed.
 *
 * On 2026-09-25, MP 1.394/2026 banned all betting advertising in Brazil. A
 * Medida Provisória is provisional: it has force of law immediately, Congress
 * has 60 + 60 days to convert or drop it, and a challenge at the STF was
 * reported. So the cutoff date and the wording are deliberately easy to edit,
 * and the rule is dated rather than absolute: a post from before the MP is
 * flagged as "check whether the operator was licensed", not as a violation.
 */

export const BETS_BAN_DATE = "2026-09-25";

/**
 * Operators and products. Matching any of these, anywhere, is a strong signal
 * by itself. Written as plain lowercase strings and compiled with word
 * boundaries, so "betano" matches "@betano" and "betano.com" but "bet" alone
 * never gets here.
 */
export const BETS_STRONG_TERMS: string[] = [
  "betano",
  "bet365",
  "blaze",
  "superbet",
  "sportingbet",
  "kto",
  "esportes da sorte",
  "esportesdasorte",
  "estrela bet",
  "estrelabet",
  "pixbet",
  "betnacional",
  "novibet",
  "stake",
  "vai de bet",
  "vaidebet",
  "betfair",
  "br4bet",
  "h2bet",
  "betmgm",
  "bet7k",
  "betsul",
  "aposta ganha",
  "apostaganha",
  "rei do pitaco",
  "reidopitaco",
  "f12 bet",
  "f12bet",
  "lotogreen",
  "mc games",
  "mcgames",
  "fortune tiger",
  "tigrinho",
  "jogo do tigrinho",
  "fortune rabbit",
  "fortune ox",
  "fortune mouse",
  "cassino",
  "casino",
  "slots",
  "aviator",
  "mines",
  "bet.br",
];

/**
 * Generic words that only count next to betting context. "aposto que" and
 * "I bet" are everyday speech; "bet" + "bônus" + "código" is an ad.
 */
export const BETS_WEAK_TERMS: string[] = ["aposta", "apostas", "bet", "bets", "apostar", "palpite", "odd", "odds"];

export const BETS_CONTEXT_TERMS: string[] = [
  "odds",
  "odd",
  "bônus",
  "bonus",
  "cupom",
  "código",
  "codigo",
  "cadastro",
  "cadastre",
  "cadastra",
  "link na bio",
  "link",
  "depósito",
  "deposito",
  "saque",
  "ganhe",
  "multiplicador",
  "giros grátis",
  "giros gratis",
  "rodadas grátis",
  "promo",
  "promoção",
];

export type BetsHit = {
  /** "bio" | "link" | "post" */
  where: "bio" | "link" | "post";
  /** ISO date of the post, or null for bio and link. */
  date: string | null;
  /** Permalink of the post, or the profile link. */
  href: string | null;
  term: string;
  /** Posts on or after the ban, and anything in the bio or link, read as high risk. */
  level: "alto" | "anterior";
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
// Unicode-aware boundaries so "é" and "ã" don't break a word.
const bounded = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(s)}(?![\\p{L}\\p{N}])`, "iu");

const STRONG = BETS_STRONG_TERMS.map((t) => ({ t, re: bounded(t) }));
const WEAK = BETS_WEAK_TERMS.map((t) => ({ t, re: bounded(t) }));
const CONTEXT = BETS_CONTEXT_TERMS.map((t) => bounded(t));

/** The term that fires in this text, or null. */
export function betsTermIn(text: string | null | undefined): string | null {
  if (!text) return null;
  const s = text.normalize("NFC");
  for (const { t, re } of STRONG) if (re.test(s)) return t;
  const weak = WEAK.find(({ re }) => re.test(s));
  if (weak && CONTEXT.some((re) => re.test(s))) return weak.t;
  return null;
}

export type BetsInput = {
  bio: string | null;
  link: string | null;
  profileUrl: string | null;
  posts: { caption: string; postedAt: string | null; permalink: string | null }[];
};

export function scanBets(input: BetsInput): BetsHit[] {
  const hits: BetsHit[] = [];
  const ban = Date.parse(`${BETS_BAN_DATE}T00:00:00-03:00`);

  const bio = betsTermIn(input.bio);
  if (bio) hits.push({ where: "bio", date: null, href: input.profileUrl, term: bio, level: "alto" });
  const link = betsTermIn(input.link);
  if (link) hits.push({ where: "link", date: null, href: input.link, term: link, level: "alto" });

  for (const p of input.posts) {
    const term = betsTermIn(p.caption);
    if (!term) continue;
    const at = p.postedAt ? Date.parse(p.postedAt) : NaN;
    hits.push({
      where: "post",
      date: p.postedAt,
      href: p.permalink,
      term,
      level: Number.isFinite(at) && at < ban ? "anterior" : "alto",
    });
  }
  return hits;
}
