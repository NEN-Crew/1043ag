import Link from "next/link";
import type { CreatorReport } from "@/lib/report";
import type { PlatformView } from "@/lib/metrics";
import { TIERS } from "@/lib/benchmarks";
import { dash, formatRate } from "@/lib/format";
import { Caption } from "./ui";

/**
 * The "Info" frame: what the connection allows, how the score is built (with
 * this creator's own numbers), what a good engagement rate is for each size
 * of profile, and the questions people actually ask. The score strip and the
 * highlighted table row are the only parts that change per creator.
 */
export default function InfoView({
  report,
  view,
  backHref,
}: {
  report: CreatorReport;
  view: PlatformView | null;
  backHref: string;
}) {
  const isTikTok = view?.platform === "tiktok";
  const excellentFrom = (hi: number) => `${formatRate(hi * 1.25, 2)}%`;

  return (
    <main className="shell">
      <div className="info-head">
        <div>
          <h1 className="h1">informações</h1>
          <p className="lede" style={{ marginTop: 10 }}>tudo o que aparece no painel tem uma conta por trás.</p>
        </div>
        <Link href={backHref} className="btn">voltar para os dados</Link>
      </div>

      <h3 className="h3" style={{ marginBottom: 14 }}>o que a conexão permite</h3>
      <div className="two">
        <div className="card">
          <div className="card-title">lemos</div>
          <div className="list">
            {[
              "Seguidores e nº de posts",
              "Curtidas, comentários, salvos e envios",
              "Alcance e views dos seus posts",
              "Sua foto e seu @",
              "Resumo da audiência (só Instagram)",
            ].map((t) => (
              <div key={t}><i />{t}</div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">nunca fazemos</div>
          <div className="list">
            {[
              "Publicar, curtir ou comentar",
              "Seguir ou deixar de seguir",
              "Ler ou mandar mensagens",
              "Ver ou guardar sua senha",
              "Mostrar seus números a outro creator",
            ].map((t) => (
              <div key={t}><i />{t}</div>
            ))}
          </div>
        </div>
      </div>

      <h3 className="h3" id="score" style={{ margin: "40px 0 14px" }}>
        como o score é montado{view ? ` · ${view.label.toLowerCase()}` : ""}
      </h3>
      {view ? (
        <>
          <div className="score-strip">
            {view.components.map((c) => (
              <div className="score-cell" key={c.key}>
                <span className="l">{c.label.toLowerCase()} · {Math.round(c.weight * 100)}%</span>
                <span className="v">{c.score ?? dash}</span>
                <span className="d">{c.display}</span>
                <span className="n">normal: {c.benchmark}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 16, paddingLeft: 10, maxWidth: 860 }}>
            {view.components.map((c) => (
              <p className="body" key={c.key}>
                <b>{c.label}.</b> {c.note}
              </p>
            ))}
            <Caption>
              Escala igual em todos os componentes: 50 é o piso do normal, 80 o topo, 100 o dobro do topo. Componentes sem
              dados ficam de fora e os demais são repesados. O score fica em branco com menos de 3 posts no período.
            </Caption>
          </div>
        </>
      ) : (
        <div className="notice">Conecte uma rede para ver o seu score por componente.</div>
      )}

      <h3 className="h3" style={{ margin: "44px 0 4px" }}>o que é uma boa taxa de engajamento?</h3>
      <p className="statement">
        um número “baixo” num perfil grande pode ser melhor que um número “alto” num perfil pequeno.
      </p>

      <div className="card" style={{ marginTop: 30, padding: "20px 28px 10px" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>seu perfil</th>
              <th>seguidores</th>
              <th>esperado</th>
              <th>excelente a partir de</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((t, i) => {
              const next = TIERS[i + 1];
              const range =
                i === 0
                  ? `até ${fmtK(next.min)}`
                  : next
                  ? `${fmtK(t.min)} a ${fmtK(next.min)}`
                  : `${fmtK(t.min)} ou mais`;
              const me = !isTikTok && view?.tier.name === t.name;
              return (
                <tr key={t.name} className={me ? "me" : undefined}>
                  <td>{t.name}{me && " · você"}</td>
                  <td>{range}</td>
                  <td>{edge(t.band[0])} a {edge(t.band[1])}%</td>
                  <td>{excellentFrom(t.band[1])}</td>
                </tr>
              );
            })}
            <tr className={isTikTok ? "me" : undefined}>
              <td>TikTok{isTikTok && " · você"}</td>
              <td>qualquer tamanho</td>
              <td>4 a 8% das views</td>
              <td>{excellentFrom(8)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="lede" style={{ fontSize: 19, lineHeight: 1.2, margin: "16px 0 0 10px", color: "#737373" }}>
        engajamento cai conforme o perfil cresce — por isso a comparação é sempre com perfis do seu tamanho, nunca com o
        creator do lado.
      </p>

      <h3 className="h3" style={{ margin: "48px 0 14px" }}>perguntas frequentes</h3>
      <div className="faq-grid">
        {FAQ.map((f) => (
          <div className="card" key={f.q}>
            <div className="faq-q">{f.q}</div>
            <p className="body">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="dash-foot" style={{ alignItems: "center" }}>
        <p className="faq cobalt">
          qualquer número estranho, chama a gente.
          <br />
          tudo tem uma conta atrás, e ela pode ser mostrada.
        </p>
        <Link href={backHref} className="btn">voltar para os dados</Link>
      </div>
      <div className="foot-note">
        <span>1043 AG · creator performance</span>
        <span>{report.influencer.name}</span>
      </div>
    </main>
  );
}

const FAQ = [
  {
    q: "os números não batem com o app do Instagram.",
    a: "quase sempre é período. o painel mostra os posts dos últimos 30 dias; o app mostra o total da conta desde sempre. os dois estão certos, contando coisas diferentes. a soma de curtidas do período fica logo abaixo de alcance & crescimento, e o total da conta aparece na nota embaixo dela.",
  },
  {
    q: "não aparece alcance no meu tiktok.",
    a: "o tiktok não entrega alcance pela api — nem salvos, nem dados de audiência. no lugar do alcance usamos views. não é erro do painel nem do seu perfil.",
  },
  {
    q: "meu crescimento está vazio.",
    a: "o painel guarda uma foto dos seus números por dia. crescimento e as curvinhas precisam de algumas semanas de fotos para existir. quem conectou há pouco tempo começa sem essa parte.",
  },
  {
    q: "atualizei e não mudou nada.",
    a: "instagram e tiktok atualizam as próprias estatísticas com atraso — às vezes horas. além disso, os números já são recolhidos automaticamente todo dia de manhã, então na maior parte do tempo não há o que atualizar.",
  },
  {
    q: "o botão de atualizar não deixa.",
    a: "você pode atualizar 1 vez a cada 12 horas. é um limite do painel, para não estourar a cota de chamadas que as plataformas nos dão. a coleta automática diária continua rodando normalmente.",
  },
  {
    q: "quero trocar minha senha ou desconectar uma rede.",
    a: "senha: peça uma nova à agência. desconectar: remova o acesso do app nas configurações do instagram ou do tiktok — os números já coletados ficam guardados no histórico.",
  },
];

/** "1,5" or "3" — a band edge without a trailing ",0". */
const edge = (n: number) => (Number.isInteger(n) ? String(n) : formatRate(n, 1));

/** 10_000 → "10 mil", 1_000_000 → "1 milhão". */
function fmtK(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000} ${n === 1_000_000 ? "milhão" : "milhões"}`;
  return `${n / 1000} mil`;
}
