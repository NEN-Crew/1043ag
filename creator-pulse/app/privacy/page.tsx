export const metadata = { title: "Privacy Policy · Pulse" };

// Contact address shown on the legal pages.
const CONTACT = "contato@1043.ag";

export default function PrivacyPage() {
  return (
    <main className="legal">
      <div className="card card-pad">
        <span className="wordmark">Pulse<span className="dot">.</span></span>
        <h1>Privacy Policy</h1>
        <p className="subtle">Last updated: October 6, 2026</p>

        <h2>1. Who we are</h2>
        <p>
          Pulse is a private analytics dashboard operated by 1043 Agency (&quot;the
          Agency&quot;) for creators it works with. This policy explains what data the
          Service collects, why, and how it is handled.
        </p>

        <h2>2. Data we collect</h2>
        <p>With your explicit authorization through each platform&apos;s official OAuth flow, the Service retrieves from the Instagram and TikTok APIs:</p>
        <ul>
          <li>Profile information: username, follower/following counts, content counts.</li>
          <li>Content performance: per-post/per-video metrics such as views, reach, likes, comments, shares and saves.</li>
          <li>Aggregated, anonymous audience demographics (age ranges, gender, country) as provided by the platforms. This never includes personal data about individual followers.</li>
        </ul>
        <p>
          We also store the account details the Agency creates for you (name, email,
          a hashed password) and the OAuth tokens needed to retrieve your data.
        </p>

        <h2>3. What we do NOT collect</h2>
        <p>
          The Service does not access your private messages, your platform passwords,
          or any data about individual followers. Data about creators who use the
          Service comes only from official platform APIs under permissions they
          granted. The Agency also reads public profile data of creators it may want
          to work with, as described in section 9 below.
        </p>

        <h2>4. How data is used</h2>
        <p>
          Your data is used solely to display your performance to you and to the
          Agency&apos;s team, and to inform the Agency&apos;s work with you (reporting,
          campaign planning). It is not sold, rented, or shared with third parties
          outside the Agency, except as required by law.
        </p>

        <h2>5. Storage and security</h2>
        <p>
          Data is stored in a managed PostgreSQL database. OAuth tokens are encrypted
          at rest (AES-256-GCM); passwords are stored only as salted hashes. Access to
          the dashboard is restricted to you (your own data) and Agency administrators.
        </p>

        <h2>6. Retention and deletion</h2>
        <p>
          Statistics are retained for as long as you collaborate with the Agency, to
          allow historical reporting. You may disconnect a platform at any time by
          revoking the app&apos;s access in Instagram/TikTok settings. This invalidates
          the stored token. To have your account and stored data deleted, contact{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we will remove them within 30
          days.
        </p>

        <h2>7. Your rights</h2>
        <p>
          Under applicable data-protection law (including the Brazilian LGPD), you may
          request access to, correction of, or deletion of your personal data, and you
          may withdraw consent at any time. Contact us at the address below.
        </p>

        <h2>8. Contact</h2>
        <p>
          Privacy questions or requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2>9. Creator prospecting</h2>
        <p>
          <strong>Who uses it.</strong> Only the Agency&apos;s staff, inside a
          restricted area of the Service. Creators who use the Service never see it.
        </p>
        <p>
          <strong>What it collects.</strong> Public profile and post data of creators
          who are not users of the Service: username, display name, bio, bio link,
          profile picture link, follower, following and post counts, and for recent
          posts the caption, date, link, thumbnail link and public counts (likes,
          comments, views, shares, saves). Instagram data is read through Meta&apos;s
          official Business Discovery API, which only returns professional accounts.
          TikTok data is read through a third-party public-data provider
          (ScrapeCreators), because TikTok offers no official equivalent.
        </p>
        <p>
          <strong>Purpose.</strong> Evaluating a possible commercial partnership:
          representing the creator or booking them for a brand campaign.
        </p>
        <p>
          <strong>Legal basis.</strong> The Agency&apos;s legitimate interest (LGPD,
          Art. 7, IX and Art. 10), limited to public data, the stated purpose and the
          minimum needed for it.
        </p>
        <p>
          <strong>Never collected.</strong> Comments and their authors, the identities
          of followers, private content, direct messages, contact details, precise
          locations, or copies of images. Any contact detail is typed in by staff
          after a conversation with the creator, never collected.
        </p>
        <p>
          <strong>Retention.</strong> Prospect data is deleted automatically after 12
          months without a new lookup or edit, unless a partnership was closed.
        </p>
        <p>
          <strong>Your rights.</strong> If you are a creator and want to know whether
          the Agency holds data about you, object to it or have it deleted, write to{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We answer within 15 days. A
          deletion request also blocks any future lookup of your account.
        </p>
        <p>
          <strong>International transfer.</strong> The data is processed by providers
          based in the United States (Vercel for hosting, Neon for the database and,
          for TikTok lookups, ScrapeCreators), under their standard contractual terms.
        </p>

        <h2>10. Prospecção de creators (em português)</h2>
        <p>
          <strong>Quem usa.</strong> Só a equipe da Agência, numa área restrita do
          Serviço. Creators que usam o Serviço nunca a veem.
        </p>
        <p>
          <strong>O que coleta.</strong> Dados públicos de perfil e de posts de
          creators que não são usuários do Serviço: nome de usuário, nome de exibição,
          bio, link da bio, link da foto de perfil, contagens de seguidores, seguindo e
          posts e, dos posts recentes, legenda, data, link, link da miniatura e
          contagens públicas (curtidas, comentários, views, compartilhamentos,
          salvos). No Instagram, os dados vêm da API oficial Business Discovery da
          Meta, que só devolve contas profissionais. No TikTok, de um provedor
          terceiro de dados públicos (ScrapeCreators), porque o TikTok não oferece
          equivalente oficial.
        </p>
        <p>
          <strong>Finalidade.</strong> Avaliar uma possível parceria comercial:
          representar o creator ou contratá-lo para uma campanha de marca.
        </p>
        <p>
          <strong>Base legal.</strong> Legítimo interesse da Agência (LGPD, art. 7º,
          IX e art. 10), limitado a dados públicos, à finalidade declarada e ao mínimo
          necessário para ela.
        </p>
        <p>
          <strong>Nunca coletado.</strong> Comentários e seus autores, identidade de
          seguidores, conteúdo privado, mensagens diretas, dados de contato,
          localização precisa ou cópias de imagens. Qualquer contato é digitado pela
          equipe depois de uma conversa com o creator, nunca coletado.
        </p>
        <p>
          <strong>Retenção.</strong> Os dados de um perfil prospectado são apagados
          automaticamente após 12 meses sem nova busca ou edição, salvo quando houve
          parceria fechada.
        </p>
        <p>
          <strong>Seus direitos.</strong> Se você é creator e quer saber se a Agência
          guarda dados sobre você, se opor a isso ou pedir a exclusão, escreva para{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Respondemos em até 15 dias. Um
          pedido de exclusão também bloqueia qualquer busca futura da sua conta.
        </p>
        <p>
          <strong>Transferência internacional.</strong> Os dados são processados por
          provedores sediados nos Estados Unidos (Vercel para hospedagem, Neon para o
          banco de dados e, nas buscas do TikTok, ScrapeCreators), sob seus termos
          contratuais padrão.
        </p>
      </div>
    </main>
  );
}
