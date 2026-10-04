# Feature map

One row per user-facing surface. `pnpm check:features` fails when a route in code has no row here.

| Surface | What it is | Handler | Reproduce |
| --- | --- | --- | --- |
| `web:/` | Sign-in; signed-in users go to `/dashboard` | `apps/web/src/app/page.tsx` | `curl -s localhost:3000/` |
| `web:/dashboard` | All projects | `apps/web/src/app/dashboard/page.tsx` | Sign in, open `/dashboard` |
| `web:/new` | Create a project | `apps/web/src/app/new/page.tsx`, `features/projects/actions.ts` (`createProject`) | Sign in, open `/new`, submit the form |
| `web:/p/[siteKey]/settings` | Install snippet, details, sharing, delete | `apps/web/src/app/p/[siteKey]/settings/page.tsx` | Create a project; you land here |
| `web:/api/auth/[...all]` | Better Auth endpoints (OAuth callbacks, session) | `apps/web/src/lib/auth.ts` | `curl -s -X POST localhost:3000/api/auth/sign-in/social -H 'content-type: application/json' -d '{"provider":"github"}'` |
| `web:/api/health` | Liveness; query count when `COPPER_DEBUG=1` | `apps/web/src/app/api/health/route.ts` | `curl -s localhost:3000/api/health` |
| `web:/c.js` | The tracker script, with the ingest endpoint baked in | `apps/web/src/app/c.js/route.ts`, `packages/tracker/src/c.js` | `curl -s localhost:3000/c.js \| gzip -c \| wc -c` |
| `ingest:/e` | Pageview ingest. Always answers 204 | `apps/ingest/src/app.ts` (`ingest`) | `curl -i -X POST localhost:8787/e -H 'User-Agent: Mozilla/5.0 Chrome/140' -d '{"s":"devsite001","u":"http://localhost/"}'` |
| `ingest:/live` | Visitors in the last 5 minutes, from shard memory | `apps/ingest/src/app.ts`, `shard-core.ts` | `curl -s -H 'Authorization: Bearer dev-ingest-secret' 'localhost:8787/live?site=devsite001'` |
| `ingest:/today` | Unflushed counters and breakdowns for a project | same | `curl -s -H 'Authorization: Bearer dev-ingest-secret' 'localhost:8787/today?site=devsite001'` |
| `ingest:/invalidate` | Drops a cached project config after it changes | `apps/ingest/src/projects.ts` | `curl -s -X POST -H 'Authorization: Bearer dev-ingest-secret' 'localhost:8787/invalidate?site=devsite001'` |
| `ingest:/flush` | Runs the hourly flush now; `?daily` adds retention and rollups | `apps/ingest/src/app.ts` (`runFlush`) | `curl -s -X POST -H 'Authorization: Bearer dev-ingest-secret' localhost:8787/flush` |
| `ingest:/health` | Liveness | `apps/ingest/src/app.ts` | `curl -s localhost:8787/health` |

## Driving the app locally

```bash
pnpm dev:db                      # Postgres on localhost:5433, nothing to install
DATABASE_URL=postgres://postgres@localhost:5433/postgres pnpm seed
pnpm --filter @copper/web dev    # with COPPER_DEMO_LOGIN=1 in apps/web/.env.local
```

Sign in as `demo@copper.local` with the password the seed prints.

## Driving the ingest Worker locally

```bash
cd apps/ingest
printf 'INGEST_SECRET=dev-ingest-secret\nDEV_PROJECTS={"devsite001":{"domains":[],"dailyCap":0}}\nDATABASE_URL=postgres://unused\n' > .dev.vars
pnpm dev    # wrangler dev on localhost:8787
```

Serve `apps/ingest/dev/test-page.html` with `packages/tracker/dist/c.js` at `/c.js`, open it in a browser, and watch `/live` and `/today` change. Headless Chrome's default user agent is filtered as a bot, so set a regular one when automating.
