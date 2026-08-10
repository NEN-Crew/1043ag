export const metadata = { title: "Privacy Policy — Pulse" };

// Contact address shown on the legal pages.
const CONTACT = "contato@1043.ag";

export default function PrivacyPage() {
  return (
    <main className="legal">
      <div className="card card-pad">
        <span className="wordmark">Pulse<span className="dot">.</span></span>
        <h1>Privacy Policy</h1>
        <p className="subtle">Last updated: August 9, 2026</p>

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
          or any data about individual followers. It does not scrape: all data comes
          from official platform APIs under permissions you granted.
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
          revoking the app&apos;s access in Instagram/TikTok settings — this invalidates
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
      </div>
    </main>
  );
}
