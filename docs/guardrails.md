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
| Missing configuration fails by name at startup | `readEnv` in `apps/web/src/lib/env.ts` (`apps/web/test/env.test.ts`); `assertEnv` in `apps/ingest/src/index.ts` |
| The tracker stays under 1.5 KB gzipped | `packages/tracker/test/tracker.test.ts` |
| No IP address or user agent is stored | `apps/ingest/test/shard.test.ts` ("stores neither the IP address nor the user agent") |
| A failed flush never loses or double counts an hour | `apps/ingest/test/app.test.ts`, `packages/db/test/store.test.ts` |
| Unknown site keys cannot keep the database awake | `ProjectDirectory` negative cache and lookup budget; `apps/ingest/test/app.test.ts` |
