# Guardrails

Each rule and the thing that enforces it. A rule with nothing in the right-hand column is a wish.

| Rule | Enforced by |
| --- | --- |
| Code is formatted and lint-clean | `pnpm lint` (Biome, read-only) in the `lint` CI job; `.husky/pre-commit` formats staged files with lint-staged |
| Types hold across packages | `pnpm typecheck` in the `typecheck` CI job; route types are generated in the same command |
| Tests pass | `pnpm test` in the `test` CI job |
| The production build works | `pnpm build` in the `build` CI job and in the pre-push hook |
| Nothing is pushed unchecked | `.husky/pre-push` runs `pnpm check`, then `pnpm build` |
| Only `packages/db` opens database connections | Biome `noRestrictedImports` on `pg` and `@neondatabase/serverless` |
| Migrations apply from empty and match the schema | `migrations` CI job (Postgres service) and `packages/db/test/migrate.test.ts` |
| Concurrent migration runs do not interleave | Transaction-level advisory lock in `packages/db/src/migrate.ts` |
| A flush is never counted twice | `flush_log` primary key; `packages/db/test/store.test.ts` |
| Every route has a feature-map row | `pnpm check:features` in the `docs` CI job |
| Markdown links and anchors resolve | `pnpm check:docs` in the `docs` CI job |
| The custom checks can fail | `pnpm test:scripts` runs each against a fixture built to fail it |
| The right package manager and Node version | `packageManager` and `engines` in `package.json`; CI reads `.nvmrc` |
| Installs do not change the lockfile in CI | `pnpm install --frozen-lockfile` in the shared setup action |
| CI steps are pinned | Third-party actions referenced by commit hash; Dependabot moves them |
| Secrets and database code stay out of the browser bundle | `import 'server-only'` first in `apps/web/src/lib/{env,db,auth}.ts` and `features/*/queries.ts` |
| Missing configuration fails by name at startup | `readEnv` in `apps/web/src/lib/env.ts` (`apps/web/test/env.test.ts`); `assertEnv` in `apps/ingest/src/index.ts`; the `DATABASE_URL` check first in the `migrate` and `seed` scripts |
| The tracker stays under 1.5 KB gzipped | `packages/tracker/test/tracker.test.ts` |
| No IP address or user agent is stored | `apps/ingest/test/shard.test.ts` ("stores neither the IP address nor the user agent") |
| A failed flush never loses or double counts an hour | `apps/ingest/test/app.test.ts`, `packages/db/test/store.test.ts` |
| Unknown site keys cannot keep the database awake | `ProjectDirectory` negative cache and lookup budget; `apps/ingest/test/app.test.ts` |
| Repeat dashboard visits do not query the database | `unstable_cache` with `project:` and `owner:` tags; check with `COPPER_DEBUG=1` and `/api/health` |
| Chart colors pass the palette checks on both surfaces | `--chart` in `apps/web/src/app/globals.css`, validated with the dataviz palette script |
| Script entry points start outside the bundler and test runner | `migrations` CI job runs `migrate` and `seed` with `tsx` against a real Postgres |
| One Node major everywhere | `.nvmrc`, `engines` (`22.x`) and `@types/node` (`^22`) agree; CI reads `.nvmrc`; Dependabot holds `@types/node` majors |
| The dev overlay is not in screenshots | `devIndicators: false` in `apps/web/next.config.ts` |

## Waiting on a person

| Rule | What is missing |
| --- | --- |
| A red or missing check blocks the merge | Branch protection on `main` is a repository setting, not a file. Require `lint`, `docs`, `typecheck`, `test`, `build` and `migrations`, and require branches to be up to date. Then open one pull request that fails on purpose and confirm the merge is refused. |

## Not adopted

Practices from the [engineering practices guide](https://www.expeditionlabs.co/resources/engineering-practices/llms.txt) that were considered and left out, and what would change that.

| Practice | Why not here | Adopt when |
| --- | --- | --- |
| Changed-files gate and job-level skip conditions | No job skips anything, so there is no skip logic to get wrong. CI has no path filters. | CI gets slow enough that docs-only changes should skip it |
| Scheduled infrastructure-dependent suite | Every CI job is hermetic: the only service is a Postgres container the job owns. | A suite needs a live Neon or Cloudflare account |
| Port and resource registry | No port is assigned by hand. `dev:db` takes `PORT` and Next picks a free port itself. | Two working copies routinely run at once |
| Canonical class ordering | Biome's `useSortedClasses` is still a nursery rule. | It is promoted to a stable group |
| Blame-ignore file | Biome has formatted the code since the first commit, so there is no mass reformat to hide. | A formatter or config change rewrites many files |
| Language-neutral migration runner per runtime | TypeScript is the only runtime that writes the schema. The migrations are already plain SQL files. | A second language writes to the database |
