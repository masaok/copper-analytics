# Self-hosting

Copper runs in two modes. Both use the same rollup, top-N and hashing code.

| Mode | Runs on | Ingest | For |
| --- | --- | --- | --- |
| Simple | One Node process and any Postgres | `POST /api/e`, buffered in the process and written every 5 minutes | A handful of sites |
| Edge | The web app, a Cloudflare Worker with Durable Objects, and Neon | The Worker, written once an hour | Hundreds of sites on free tiers |

## Quickstart: Docker

```bash
git clone https://github.com/masaok/copper-analytics.git
cd copper-analytics
docker compose up
```

Open <http://localhost:3000> and sign in as `demo@copper.local` with the password `copper-demo`. The demo account has five projects with 30 days of made-up traffic.

Before real use, set these in a `.env` file next to `docker-compose.yml`:

```bash
BETTER_AUTH_URL=https://stats.example.com
BETTER_AUTH_SECRET=<openssl rand -base64 32>
GITHUB_CLIENT_ID=<from a GitHub OAuth app>
GITHUB_CLIENT_SECRET=<from the same app>
COPPER_DEMO_LOGIN=0
COPPER_SEED=0
```

The GitHub OAuth app's callback URL is `<BETTER_AUTH_URL>/api/auth/callback/github`.

To sign in with [JustAuth](https://justauth.org) instead of, or as well as, GitHub, create an app there with the redirect URI `<BETTER_AUTH_URL>/api/auth/callback/justauth` and set `JUSTAUTH_CLIENT_ID` and `JUSTAUTH_CLIENT_SECRET`.

### Signing in from another site

Another site on the same parent domain, such as a marketing site at `www.example.com`, can run the whole sign-in without sending people to the dashboard's host first:

1. On that site, rewrite `/api/auth/:path*` to `<BETTER_AUTH_URL>/api/auth/:path*`.
2. On the dashboard, set `COOKIE_DOMAIN=.example.com`, `TRUSTED_ORIGINS=https://www.example.com` and `JUSTAUTH_REDIRECT_URI=https://www.example.com/api/auth/callback/justauth`, and add that redirect URI to the JustAuth app.
3. On that site, `POST /api/auth/sign-in/social` with `{"provider":"justauth","callbackURL":"<BETTER_AUTH_URL>/dashboard"}` and send the browser to the `url` in the response.

JustAuth returns to the other site, the dashboard sets the session cookie on the parent domain, and the browser lands on the dashboard signed in.

## Quickstart: Node

```bash
pnpm install
pnpm dev:db                                   # Postgres on localhost:5433, nothing to install
cp .env.example apps/web/.env.local           # then fill in the three required values
DATABASE_URL=postgres://postgres@localhost:5433/postgres pnpm seed
pnpm --filter @copper/web dev
```

For the demo account, set `COPPER_DEMO_LOGIN=1` in `apps/web/.env.local`.

## Simple mode on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmasaok%2Fcopper-analytics&root-directory=apps%2Fweb&env=DATABASE_URL,BETTER_AUTH_SECRET,BETTER_AUTH_URL,GITHUB_CLIENT_ID,GITHUB_CLIENT_SECRET)

Simple mode buffers pageviews in the process's memory. A serverless platform runs many short-lived processes, so each one holds its own buffer and live counts are approximate. For Vercel, use edge mode.

## Edge mode

1. Create a Neon project and apply the migrations, as [Migrations](#migrations) describes. The pooled string works.
2. In `apps/ingest`, run `wrangler login`, then set the secrets:

   ```bash
   wrangler secret put DATABASE_URL        # the same pooled Neon string
   wrangler secret put INGEST_SECRET       # any long random string
   wrangler secret put REVALIDATE_SECRET   # another one
   ```

3. Set `APP_URL` in `apps/ingest/wrangler.toml` to the web app's URL and run `pnpm --filter @copper/ingest deploy`.
4. On the web app, set `COPPER_MODE=edge`, `INGEST_URL` (the Worker's URL), and the same `INGEST_SECRET` and `REVALIDATE_SECRET`.

A KV namespace bound as `PROJECTS` keeps project settings out of the database's way. Without it, each Worker isolate asks the database once every five minutes per active project, which keeps Neon awake.

## Migrations

Pending migrations apply on their own in two places:

- The Docker image's entry point, `scripts/start.sh`, runs them before it starts the server.
- A Vercel production build runs them before `next build` (`scripts/vercel-build.mjs`, the build command in `apps/web/vercel.json`). Preview builds never do. A failed migration fails the build, so the previous deployment keeps serving. To re-run them, redeploy production.

Anywhere else, run `DATABASE_URL=... pnpm --filter @copper/db migrate` before you start the new code. It applies only what is pending and is safe to run twice or from two machines at once.

The old code keeps serving while the new schema goes in, so every migration must work with the code before it. Add columns and tables in one release and drop or rename them in a later one, after no deployed code reads them. A new `not null` column needs a default.

## Configuration

[.env.example](../.env.example) lists every variable. The app stops at startup and names any that are missing.

## Installing the tracker

Plain HTML:

```html
<script defer src="https://stats.example.com/c.js" data-site="YOUR_SITE_KEY"></script>
```

Next.js, with `@copper-analytics/next`:

```tsx
import { CopperAnalytics } from '@copper-analytics/next'

// in app/layout.tsx, inside <body>
<CopperAnalytics siteKey="YOUR_SITE_KEY" host="https://stats.example.com" />
```

Astro, in a layout's `<head>`:

```astro
<script is:inline defer src="https://stats.example.com/c.js" data-site="YOUR_SITE_KEY"></script>
```

### Serving the tracker from your own domain

Ad blockers may list any domain that contains "analytics". A same-origin proxy avoids that. In `next.config.ts`:

```ts
async rewrites() {
  return [
    { source: '/stats/c.js', destination: 'https://stats.example.com/c.js' },
    { source: '/stats/e', destination: 'https://stats.example.com/api/e' },
  ]
}
```

Then load `/stats/c.js` with `data-api="/stats/e"`. On Vercel or Netlify the same two rules work as rewrites in `vercel.json` or `_redirects`.

### Opting out

- A visitor who runs `localStorage.setItem('copper_ignore', '1')` is not counted.
- A page that contains an element with `data-copper-ignore` is not counted.
- `localhost` and `file:` pages are not counted unless the script tag has `data-dev`.

## Stats API

Create a token on a project's settings page, then:

```bash
curl -H "Authorization: Bearer <token>" \
  "https://stats.example.com/api/v1/stats?site=YOUR_SITE_KEY&range=7d"
```

`range` is one of `today`, `24h`, `7d`, `30d`, `12mo`, `custom`. With `custom`, add `from` and `to` as `YYYY-MM-DD`.

## What is stored

Rollups only: counters per hour and per day, and the top 50 pages, referrer domains, countries, devices, browsers, operating systems and UTM sources per day. No IP address, no user agent, no full URL and no cookie is stored. A visitor is a hash of a daily salt, the site key, the IP address and the user agent; the salt changes at midnight UTC, so a visitor cannot be followed from one day to the next.
