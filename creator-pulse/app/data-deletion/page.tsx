import { sql } from "@/lib/db";

export const metadata = { title: "Data Deletion · Pulse" };
export const dynamic = "force-dynamic";

// Contact address shown on the legal pages.
const CONTACT = "contato@1043.ag";

type Request = {
  confirmation_code: string;
  platform: string;
  status: string;
  requested_at: string;
};

async function lookup(code: string | undefined): Promise<Request | null | "invalid"> {
  if (!code) return null;
  const clean = code.trim().toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(clean)) return "invalid";
  const rows = await sql`
    select confirmation_code, platform, status, requested_at
    from data_deletion_requests where confirmation_code = ${clean}`;
  return (rows[0] as Request | undefined) ?? "invalid";
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { timeZone: "America/Sao_Paulo", dateStyle: "long", timeStyle: "short" });
}

export default async function DataDeletionPage({ searchParams }: { searchParams: { code?: string } }) {
  const found = await lookup(searchParams.code);

  return (
    <main className="legal">
      <div className="card card-pad">
        <span className="wordmark">Pulse<span className="dot">.</span></span>
        <h1>Data Deletion</h1>
        <p className="subtle">Last updated: October 28, 2026 · <a href="/privacy">Privacy Policy</a></p>

        {found === "invalid" && (
          <p><strong>Unknown confirmation code.</strong> Check the code and try again, or write to{" "}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
        )}
        {found && found !== "invalid" && (
          <p>
            <strong>Request {found.confirmation_code}</strong>: {found.status === "completed"
              ? "all data from your Instagram account has been deleted"
              : "we held no data from this Instagram account; nothing to delete"}
            . Received {fmt(found.requested_at)}.
          </p>
        )}

        <h2>How to delete your data</h2>
        <p>
          Pulse only holds data you authorized through Instagram or TikTok (profile
          numbers, post performance and aggregated audience demographics) plus the
          account the Agency created for you. You can have it removed in two ways.
        </p>

        <h2>Option 1: remove Pulse from your Instagram or TikTok account</h2>
        <ul>
          <li>
            <strong>Instagram:</strong> open the Instagram app, go to <em>Settings and
            privacy</em> → <em>Website permissions</em> → <em>Apps and websites</em> →
            <em>Active</em>, find <em>Pulse</em> (1043) and tap <em>Remove</em>.
          </li>
          <li>
            <strong>TikTok:</strong> open the TikTok app, go to <em>Settings and
            privacy</em> → <em>Security &amp; permissions</em> → <em>Apps and
            services</em>, find <em>Pulse</em> and remove it.
          </li>
        </ul>
        <p>
          Removing Pulse invalidates our access token immediately. For Instagram,
          Meta also notifies us automatically and we delete every number and
          snapshot we stored from that account on the spot. You receive a
          confirmation code and can check its status on this page at any time.
        </p>

        <h2>Option 2: ask us by email</h2>
        <p>
          Write to <a href={`mailto:${CONTACT}`}>{CONTACT}</a> from the email address
          of your Pulse account with the subject <em>Delete my data</em>. Tell us
          whether you want only the platform data removed or the whole Pulse account
          (name, email, login and all history). We confirm by email and complete the
          deletion within 30 days, usually much sooner.
        </p>

        <h2>What gets deleted</h2>
        <ul>
          <li>The access token and connection to your Instagram or TikTok account.</li>
          <li>Your profile numbers, per-post metrics and audience demographics, including the historical snapshots.</li>
          <li>On a full-account request: your name, email, login and anything else linked to your account.</li>
        </ul>
        <p>
          We keep only what the law requires, such as invoices from campaigns already
          paid, for the legally mandated period.
        </p>

        <h2>Check a confirmation code</h2>
        <form method="get" action="/data-deletion" className="deletion-check">
          <input name="code" placeholder="Confirmation code" defaultValue={searchParams.code ?? ""} />
          <button type="submit">Check</button>
        </form>

        <h2>Exclusão de dados (em português)</h2>
        <p>
          O Pulse guarda só os dados que você autorizou pelo Instagram ou TikTok
          (números do perfil, desempenho dos posts e demografia agregada da
          audiência) e a conta que a Agência criou para você. Dá para apagar tudo de
          dois jeitos.
        </p>
        <p>
          <strong>1. Remova o Pulse na própria rede.</strong> No Instagram:{" "}
          <em>Configurações e privacidade</em> → <em>Permissões de site</em> →{" "}
          <em>Apps e sites</em> → <em>Ativos</em> → <em>Pulse</em> → <em>Remover</em>.
          No TikTok: <em>Configurações e privacidade</em> → <em>Segurança e
          permissões</em> → <em>Apps e serviços</em> → <em>Pulse</em> → remover. Isso
          invalida nosso acesso na hora. No Instagram, a Meta nos avisa
          automaticamente e apagamos todos os números e históricos daquela conta no
          mesmo momento; você recebe um código de confirmação para consultar aqui.
        </p>
        <p>
          <strong>2. Peça por e-mail.</strong> Escreva para{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> a partir do e-mail da sua conta
          Pulse com o assunto <em>Excluir meus dados</em>, dizendo se quer apagar só
          os dados das redes ou a conta inteira (nome, e-mail, login e todo o
          histórico). Confirmamos por e-mail e concluímos em até 30 dias, normalmente
          bem antes.
        </p>
        <p>
          Guardamos apenas o que a lei exige, como notas fiscais de campanhas já
          pagas, pelo prazo legal.
        </p>
      </div>
    </main>
  );
}
