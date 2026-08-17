# Pulse

A tiny tool for a small agency to track its creators' **Instagram** and
**TikTok** numbers in one place. Creators connect their own accounts; the
agency sees everyone. No scraping — every number comes from the official APIs
with the creator's consent.

Built to be simple: one Next.js app, one Postgres database, deploys to Vercel.

## How it works

- **Creators** log in (with an email + password you create for them) at `/login`,
  land on `/me`, and click **Connect Instagram / Connect TikTok**. After that
  they see their own numbers.
- **The agency** opens `/admin` (one shared password), gets a sortable roster of
  every creator, and can open any of them for the full breakdown. The agency view
  also creates creator accounts.
- Numbers refresh **daily** via Vercel Cron. Anyone can also pull them on demand:
  the agency without limit, a creator once every 12h.

Instagram and TikTok numbers are stored in **separate tables**, one row per
creator each, so the split is always clear. Every refresh also appends a
snapshot to the history tables, which is where growth over time comes from.

## The design system

The UI is a Swiss / editorial grid, in **Brazilian Portuguese**. Four rules hold it
together — break one and the screen looks wrong even when every measurement is right:

1. **Four colours only.** Cobalt `#1649D6`, orange-red `#FF3B00`, ink `#202020`,
   hairline `#E5E5E5`, plus paper white. "Good" reads cobalt, "attention" reads
   orange-red. No greens, no ambers, no secondary palette.
2. **Everything is flat.** `border-radius: 0` everywhere, no shadows, no gradients.
   Separation is 1px hairlines, never elevation.
3. **Two typefaces, extreme contrast.** DM Serif Display for headlines and every
   large number; Courier Prime for everything else. **There is no sans-serif** —
   body text *is* the monospace.
4. **Numbers are the art.** The engagement rate is set at up to 184px; its label is
   11px uppercase mono. That contrast is the identity.

Tokens live at the top of `app/globals.css`; primitives (`Eyebrow`, `Section`,
`Stat`, `DeltaTag`, `VerdictChip`, `Sparkline`, `BarRow`) live in `components/ui.tsx`.
Both typefaces are self-hosted through `next/font`.

**Engagement rate governs the screen.** It is the biggest number, the first thing
rendered, and what the roster ranks by. Everything else — reach, cadence, the Pulse
Score — is supporting evidence, sized and placed accordingly.

Two screens:

- `/me` — the creator's own report.
- `/admin` — the agency roster, ranked. Staff only, enforced server-side.
- `/admin/[id]` — drill-down into one creator, same report plus media value.

The roster ranks one row **per account**, not per person: comparing an Instagram ER
against a TikTok ER is meaningless, so the network filter is what produces a
like-for-like ranking, and the bar scale is relative to the filtered set. Filter and
sort live in the URL (`?rede=tiktok&ordem=seguidores`) so a view is shareable.

## What the numbers mean

Follower counts don't decide campaigns, so the dashboard leads with a **Pulse
Score** (0–100) per platform and one follower-weighted score per creator.

It's four components, each measured against a published benchmark and each shown
with its own number so nothing is a black box:

| Component | Weight | What it measures | Normal |
| --- | --- | --- | --- |
| **Engagement** | 40% | Interactions on a typical post ÷ followers | the account's size band (nano 3–5% → mega 0.5–1%) |
| **Reach** | 25% | Views on a typical post ÷ followers | 10% floor, ~30% typical |
| **Impact** | 20% | Share of reactions that were comments, saves or shares rather than likes | 8% normal, 20%+ strong (IG) |
| **Consistency** | 15% | Posts per week across the observed window | 3/wk strong |

Every component uses the same scale, so a 70 always means the same thing:

- **50** — the bottom of what's normal
- **80** — the top of what's normal
- **100** — double the top

### The engagement rate, exactly

```
interações do post = curtidas + comentários + salvos + enviados   (TikTok: sem salvos)
ER                 = mediana(interações) ÷ seguidores × 100
```

The same formula runs at both levels — the headline rate and every post badge.
Three rules make it hold up to scrutiny:

- **One denominator on the screen: followers.** Dividing a post by *reach* is
  defensible and arguably more precise, but it produced a screen that contradicted
  itself: a post with 116 likes ranked above one with 230, because the second had
  reached 5× more people. Followers are constant across a creator's posts, so
  ER-by-followers orders posts identically to their raw interaction counts — the
  badge can never disagree with the numbers printed beside it. Reach-based
  engagement still appears, but under its own name (*sobre o alcance*), never as "ER".
- **The parts are summed, not Instagram's `total_interactions`.** IG's aggregate
  runs 3–13% above the sum of the components it reports, which would leave a badge
  nobody could reconcile with the counts on the tile. TikTok has no equivalent
  aggregate either, so summing keeps one formula across both platforms. A number
  you can add up yourself beats a marginally more official one.
- **Every input is on the tile.** Likes, comments and sends are printed on each
  post, and they are exactly what enters the badge.

Deliberate choices worth knowing about:

- **Medians, not averages.** One viral post shouldn't reset expectations for the
  next brief — and the gap between the two is itself the outlier signal.
- **Neutral language.** Posts are grouped as *mais* / *menos engajamento*, never
  best/worst. A post that reached more people isn't a worse post, and a creator
  reading their own report shouldn't be told their work was "the worst". Verdicts
  are descriptive for the same reason: Excelente (85+) · Bom (55+) · Na média
  (40+) · Abaixo da média — never "Ruim".
- **Counts are exact, never abbreviated.** 9.629 seguidores, not "10k"; 2.303
  curtidas, not "2 mil". Rounding to the nearest thousand is a 13% error at these
  magnitudes, and a creator checking the screen against their own profile finds a
  number that is simply wrong.
- **Engagement is graded against the account's size band.** Engagement falls as
  an audience grows, so 2% means something very different at 5k and at 5M.
- **Saves and shares are the point.** A send is worth roughly 3–5 likes to the
  algorithm and a save around 10, so Instagram cards surface *sends per reach*
  (1–2% is solid) — the metric that predicts whether a post escapes the existing
  audience. Follower count doesn't.
- **Missing data is dropped, not punished.** Instagram doesn't return reach for
  every media type and TikTok returns no saves at all. Components we can't
  measure are left out and the rest re-weighted, and TikTok's Impact band is
  scaled to the signals its API actually gives us.
- **Below three recent posts there's no score.** Rating an account off one post
  is a coin flip with a number on it.
- **Media value is agency-only** and is a bought-media floor: a typical post's
  views priced at the configured CPM. It's a starting point for a quote, not a
  rate card — creator fees normally sit above it. Set `MEDIA_VALUE_CURRENCY`,
  `MEDIA_VALUE_CPM_LOW` and `MEDIA_VALUE_CPM_HIGH` to match your market
  (defaults: R$15–35, the Brazilian band).

All of it lives in `lib/benchmarks.ts` — one file, so there's exactly one place
to argue with when the market moves.

<details>
<summary>Where the benchmark numbers come from</summary>

- Engagement bands by follower tier —
  [Influency.me](https://ajuda.influency.me/pt-BR/articles/11458998-engajamento-como-calcular-e-qual-e-a-taxa-ideal),
  corroborated by
  [2026 tier benchmarks](https://nowadays.media/blog/influencer-engagement-rate-benchmarks-2026-by-platform-niche-follower-tier/)
- View rate (5–10% good, 10%+ excellent) —
  [Influency.me metrics guide](https://ajuda.influency.me/pt-BR/articles/13534180-guia-de-metricas-da-plataforma-influency-me)
- Reels reach rate ~31% —
  [Socialinsider](https://www.socialinsider.io/social-media-benchmarks/instagram)
- Sends/saves outweighing likes; 1–2% sends-per-reach —
  [Instagram algorithm 2026](https://blog.hootsuite.com/instagram-algorithm/),
  [analysis](https://creatorflow.so/blog/instagram-algorithm-2026/)
- TikTok engagement medians —
  [Dash Social](https://www.dashsocial.com/social-media-benchmarks/tiktok)
- Brazilian CPM band R$15–35 —
  [Veeras](https://veeras.com.br/blog/quanto-custa-contratar-influenciador-digital)

</details>

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. In the Vercel project, add a **Postgres** store (Storage tab → Create →
   Postgres). Vercel sets `DATABASE_URL` automatically.
3. Add the rest of the environment variables (Project → Settings → Environment
   Variables). Generate the two secrets with `openssl rand -hex 32`:

   | Variable | What it is |
   | --- | --- |
   | `SESSION_SECRET` | signs login cookies (`openssl rand -hex 32`) |
   | `ENCRYPTION_KEY` | encrypts stored tokens — must be 64 hex chars (`openssl rand -hex 32`) |
   | `ADMIN_PASSWORD` | the shared agency password |
   | `APP_URL` | your deployment URL, e.g. `https://your-app.vercel.app` |
   | `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | from developers.facebook.com |
   | `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | from developers.tiktok.com |

4. Create the tables once. Easiest from your machine, pointed at the same DB:
   ```bash
   npm install
   # put the Vercel Postgres connection string in .env as DATABASE_URL
   npm run db:setup
   ```
   (Or paste the contents of `schema.sql` into the Vercel Postgres query editor.)
5. Deploy. Visit `/admin`, enter the agency password, and add your first creator.

## Run locally

```bash
cp .env.example .env        # fill in the values (see table above)
npm install
npm run db:setup            # creates the tables
npm run dev                 # http://localhost:3000
```

Open `/admin` for the agency view, `/login` for a creator.

## Connecting the platforms

You need a developer app on each platform (one-time setup) and the keys go in
the env vars above.

**Instagram** — developers.facebook.com → create an app → add the **Instagram**
product → "API setup with Instagram login". Use the **Instagram** app id/secret
(not the Facebook ones). Add the redirect URI:
`${APP_URL}/api/connect/instagram/callback`. The creator's account must be a
Professional (Business or Creator) account. While your app is in development,
add each creator under *App roles → Roles → Instagram testers* so they can
authorize.

**TikTok** — developers.tiktok.com → create an app → add **Login Kit**. Add the
redirect URI: `${APP_URL}/api/connect/tiktok/callback`. Add your creators as
**Target Users** in the sandbox so they can connect before the app is approved.

Note: TikTok's basic Display API doesn't return audience demographics, so those
aren't shown for TikTok — that's expected, not a bug.

## Day-to-day

1. In `/admin`, **Add a creator** (name + email). You get a one-time password —
   send it to the creator with the login link.
2. The creator logs in at `/login`, connects their Instagram and/or TikTok.
3. Back in `/admin`, click **Refresh** on that creator to pull fresh numbers
   anytime you need them.

## What's inside

```
app/
  login/            creator login
  me/               creator's own numbers + connect buttons
  admin/            agency view (password) — roster, create, refresh
  api/
    auth/           login / logout / admin password
    admin/          create creator
    report/[id]     GET a creator's numbers (IG + TikTok, separated)
    refresh/[id]    POST pull fresh numbers (admin only)
    connect/        OAuth start + callback for each platform
lib/
  db.ts             Postgres (Neon) connection
  instagram.ts      Instagram OAuth + stats
  tiktok.ts         TikTok OAuth + stats
  benchmarks.ts     every published benchmark, in one place
  metrics.ts        raw stats -> the view model the screens consume
  history.ts        follower + engagement trends from the snapshot tables
  report.ts         one creator / the whole roster / refresh
  crypto.ts         password hashing, token encryption, signed cookies
  auth.ts           session cookies
  format.ts         pt-BR number, date and delta formatting
components/
  ui.tsx            Eyebrow · Section · Stat · DeltaTag · Verdict · Sparkline · BarRow
  Icons.tsx         the icon set (functional only — nothing decorative)
  CreatorView.tsx   masthead + sections 01–06
  Ranking.tsx       the agency roster, filtered and sorted
  TopBar.tsx        shared chrome
schema.sql          the six tables
scripts/setup-db.ts npm run db:setup
```

### Not built (and why)

- **Audience quality** — AQS, authenticity, follower composition and
  massfollowing detection are provider metrics (HypeAuditor, Modash). The official
  Instagram and TikTok APIs will never return them, so that section isn't rendered
  rather than shipped permanently empty. Engagement-vs-tier and view rate are the
  partial substitute already on screen.
- **`.pptx` export** — worth having for client decks; not built yet.
- **Real branded-content flags** — PUBLI detection reads the caption
  (`#publi`, `#ad`, `#parceria`…). A creator who forgets the hashtag shows as
  organic.

## Notes

- Tokens are encrypted at rest (AES-256-GCM). Passwords are hashed (scrypt).
  Login state is a signed, http-only cookie. No third-party auth service.
- TikTok access tokens last ~24h and are refreshed automatically on refresh
  using the stored refresh token; Instagram long-lived tokens (60d) are
  refreshed when they get close to expiring.
- This is sized for a small roster. If you ever outgrow manual refresh, a Vercel
  Cron hitting the refresh endpoint is the natural next step — no rearchitecting.
