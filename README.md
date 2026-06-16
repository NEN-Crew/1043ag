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
- **The agency** opens `/admin` (one shared password), sees every creator, and
  hits **Refresh** to pull the latest numbers. The agency view also creates
  creator accounts.
- Refresh is **manual** — nothing runs in the background. You click, it fetches.

Instagram and TikTok numbers are stored in **separate tables**, one row per
creator each, so the split is always clear.

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
  report.ts         build a report / refresh a creator
  crypto.ts         password hashing, token encryption, signed cookies
  auth.ts           session cookies
  format.ts         number formatting
schema.sql          the four tables
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
