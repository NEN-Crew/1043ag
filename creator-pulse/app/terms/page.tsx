export const metadata = { title: "Terms of Service · Pulse" };

// Contact address shown on the legal pages.
const CONTACT = "contato@1043.ag";

export default function TermsPage() {
  return (
    <main className="legal">
      <div className="card card-pad">
        <span className="wordmark">Pulse<span className="dot">.</span></span>
        <h1>Terms of Service</h1>
        <p className="subtle">Last updated: August 9, 2026</p>

        <h2>1. About this service</h2>
        <p>
          Pulse (&quot;the Service&quot;) is a private analytics dashboard operated by 1043
          Agency (&quot;the Agency&quot;). It displays audience and content statistics for
          creators who are managed by, or collaborate with, the Agency. The Service is
          not open for public registration: accounts are created by the Agency for its
          own creators.
        </p>

        <h2>2. Accounts</h2>
        <p>
          You are responsible for keeping your login credentials confidential and for
          all activity under your account. The Agency may suspend or remove accounts at
          its discretion, including when a collaboration ends.
        </p>

        <h2>3. Connected platforms</h2>
        <p>
          The Service lets you connect your Instagram and/or TikTok account through each
          platform&apos;s official authorization (OAuth) flow. By connecting an account
          you authorize the Service to retrieve, on your behalf, the profile and
          performance data described in our Privacy Policy. Your use of Instagram and
          TikTok remains governed by those platforms&apos; own terms. You may disconnect
          a platform at any time by revoking the app&apos;s access in that
          platform&apos;s settings or by contacting the Agency.
        </p>

        <h2>4. Acceptable use</h2>
        <p>
          You agree not to misuse the Service, including attempting to access data of
          other creators, probing or disrupting the Service&apos;s infrastructure, or
          using the Service in violation of applicable law.
        </p>

        <h2>5. Intellectual property</h2>
        <p>
          The Service, its design and its code remain the property of the Agency.
          Statistics about your own accounts and content remain yours; the Agency uses
          them solely to provide the Service and to support its work with you.
        </p>

        <h2>6. Disclaimer and limitation of liability</h2>
        <p>
          The Service is provided &quot;as is&quot;, without warranties of any kind.
          Metrics are retrieved from third-party platform APIs and may be delayed,
          estimated or revised by those platforms; the Agency does not guarantee their
          accuracy or availability. To the maximum extent permitted by law, the Agency
          is not liable for indirect, incidental or consequential damages arising from
          use of the Service, and its total liability is limited to the amount you paid
          to use the Service (currently zero).
        </p>

        <h2>7. Changes and termination</h2>
        <p>
          The Agency may update these terms or discontinue the Service at any time.
          Material changes will be reflected on this page with a new &quot;last
          updated&quot; date. Continued use after a change constitutes acceptance.
        </p>

        <h2>8. Contact</h2>
        <p>
          Questions about these terms: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </div>
    </main>
  );
}
