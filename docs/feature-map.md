# Feature map

One row per user-facing surface. `pnpm check:features` fails when a route in code has no row here.

| Surface | What it is | Handler | Reproduce |
| --- | --- | --- | --- |
| `web:/` | Landing and sign-in | `apps/web/src/app/page.tsx` | `curl -s localhost:3000/` |
