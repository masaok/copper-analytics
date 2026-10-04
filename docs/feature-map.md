# Feature map

One row per user-facing surface. `pnpm check:features` fails when a route in code has no row here.

| Surface | What it is | Handler | Reproduce |
| --- | --- | --- | --- |
| `web:/` | Sign-in; signed-in users go to `/dashboard` | `apps/web/src/app/page.tsx` | `curl -s localhost:3000/` |
| `web:/docs` | Public docs: install, proxy, opt-out, API, self-hosting | `apps/web/src/app/docs/page.tsx` | `curl -s localhost:3000/docs` |
| `web:/dashboard` | All projects: totals, live, today vs yesterday, 30-day sparkline | `apps/web/src/app/dashboard/page.tsx`, `features/stats/data.ts` (`loadOverview`) | Sign in, open `/dashboard` |
| `web:/new` | Create a project | `apps/web/src/app/new/page.tsx`, `features/projects/actions.ts` (`createProject`) | Sign in, open `/new`, submit the form |
| `web:/p/[siteKey]` | Project report: range picker, KPI cards, chart, breakdown panels, live count | `apps/web/src/app/p/[siteKey]/page.tsx`, `features/stats/report.tsx`, `features/stats/data.ts` (`loadReport`) | Sign in, open `/p/demoshop01?range=7d&metric=pageviews` |
| `web:/share/[siteKey]` | The same report, read-only, only while sharing is on | `apps/web/src/app/share/[siteKey]/page.tsx` | Turn sharing on in settings, open `/share/<key>` signed out |
| `web:/p/[siteKey]/export.csv` | Every stored day as CSV | `apps/web/src/app/p/[siteKey]/export.csv/route.ts` | Signed in: `/p/demoshop01/export.csv` |
| `web:/api/live/[siteKey]` | Live visitor count, polled by the report header | `apps/web/src/app/api/live/[siteKey]/route.ts` | `curl -s localhost:3000/api/live/<public key>` |
| `web:/api/e` | Simple-mode pageview ingest. Always answers 204 | `apps/web/src/app/api/e/route.ts`, `packages/core/src/ingest.ts` | `curl -i -X POST localhost:3000/api/e -H 'User-Agent: Mozilla/5.0 Chrome/140' -d '{"s":"demoshop01","u":"https://shop.acme.test/"}'` |
| `web:/api/v1/stats` | Read-only stats for one project, by per-project token | `apps/web/src/app/api/v1/stats/route.ts` | `curl -H 'Authorization: Bearer <token>' 'localhost:3000/api/v1/stats?site=demoshop01&range=7d'` |
| `web:/api/revalidate` | Drops cached reports after a flush | `apps/web/src/app/api/revalidate/route.ts` | `curl -s -X POST localhost:3000/api/revalidate -H 'Authorization: Bearer $REVALIDATE_SECRET' -d '{"siteKeys":["demoshop01"]}'` |
| `web:/p/[siteKey]/settings` | Install snippet, details, sharing, delete | `apps/web/src/app/p/[siteKey]/settings/page.tsx` | Create a project; you land here |
| `web:/api/auth/[...all]` | Better Auth endpoints (OAuth callbacks, session) | `apps/web/src/lib/auth.ts` | `curl -s -X POST localhost:3000/api/auth/sign-in/social -H 'content-type: application/json' -d '{"provider":"github"}'` |
| `web:/api/health` | Liveness; query count when `COPPER_DEBUG=1` | `apps/web/src/app/api/health/route.ts` | `curl -s localhost:3000/api/health` |
| `web:/c.js` | The tracker script, with the ingest endpoint baked in | `apps/web/src/app/c.js/route.ts`, `packages/tracker/src/c.js` | `curl -s localhost:3000/c.js \| gzip -c \| wc -c` |
| `ingest:/e` | Pageview ingest. Always answers 204 | `packages/core/src/ingest.ts` (`handlePageview`) | `curl -i -X POST localhost:8787/e -H 'User-Agent: Mozilla/5.0 Chrome/140' -d '{"s":"devsite001","u":"http://localhost/"}'` |
| `ingest:/live` | Visitors in the last 5 minutes, from shard memory | `apps/ingest/src/app.ts`, `shard-core.ts` | `curl -s -H 'Authorization: Bearer dev-ingest-secret' 'localhost:8787/live?site=devsite001'` |
| `ingest:/today` | Unflushed counters and breakdowns for a project | same | `curl -s -H 'Authorization: Bearer dev-ingest-secret' 'localhost:8787/today?site=devsite001'` |
| `ingest:/overview` | Live visitors and unflushed counters for many projects, one call per shard | `apps/ingest/src/app.ts` | `curl -s -H 'Authorization: Bearer dev-ingest-secret' 'localhost:8787/overview?sites=devsite001'` |
| `ingest:/invalidate` | Drops a cached project config after it changes | `packages/core/src/directory.ts` | `curl -s -X POST -H 'Authorization: Bearer dev-ingest-secret' 'localhost:8787/invalidate?site=devsite001'` |
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
