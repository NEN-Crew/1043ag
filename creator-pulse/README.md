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

## What the numbers mean

Follower counts don't decide campaigns, so the dashboard leads with a **Pulse
Score** (0–100) per platform and one follower-weighted score per creator.

It's four components, each measured against a published benchmark and each shown
with its own number so nothing is a black box:

| Component | Weight | What it measures | Normal |
| --- | --- | --- | --- |
| **Engagement** | 40% | Reactions on a typical post ÷ followers | the account's size band (nano 3–5% → mega 0.5–1%) |
| **Reach** | 25% | Views on a typical post ÷ followers | 10% floor, ~30% typical |
| **Impact** | 20% | Share of reactions that were comments, saves or shares rather than likes | 8% normal, 20%+ strong (IG) |
| **Consistency** | 15% | Posts per week across the observed window | 3/wk strong |

Every component uses the same scale, so a 70 always means the same thing:

- **50** — the bottom of what's normal
- **80** — the top of what's normal
- **100** — double the top

Deliberate choices worth knowing about:

- **Medians, not averages.** One viral post shouldn't reset expectations for the
  next brief.
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
  metrics.ts        raw stats -> Pulse Score, rates, formats, media value
  history.ts        follower growth from the snapshot tables
  report.ts         build a report / a whole roster / refresh a creator
  crypto.ts         password hashing, token encryption, signed cookies
  auth.ts           session cookies
  format.ts         number formatting + status tones
schema.sql          the six tables
scripts/setup-db.ts npm run db:setup
```

## Notes

- Tokens are encrypted at rest (AES-256-GCM). Passwords are hashed (scrypt).
  Login state is a signed, http-only cookie. No third-party auth service.
- TikTok access tokens last ~24h and are refreshed automatically on refresh
  using the stored refresh token; Instagram long-lived tokens (60d) are
  refreshed when they get close to expiring.
- This is sized for a small roster. If you ever outgrow manual refresh, a Vercel
  Cron hitting the refresh endpoint is the natural next step — no rearchitecting.
