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

## Driving the app locally

```bash
pnpm dev:db                      # Postgres on localhost:5433, nothing to install
DATABASE_URL=postgres://postgres@localhost:5433/postgres pnpm seed
pnpm --filter @copper/web dev    # with COPPER_DEMO_LOGIN=1 in apps/web/.env.local
```

Sign in as `demo@copper.local` with the password the seed prints.
