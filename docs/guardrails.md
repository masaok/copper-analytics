# Guardrails

Each rule and the thing that enforces it. A rule with nothing in the right-hand column is a wish.

| Rule | Enforced by |
| --- | --- |
| Code is formatted and lint-clean | `pnpm lint` (Biome, read-only) in the `lint` CI job; the pre-commit hook formats staged files |
| Types hold across packages | `pnpm typecheck` in the `typecheck` CI job; route types are generated in the same command |
| Tests pass | `pnpm test` in the `test` CI job |
| The production build works | `pnpm build` in the `build` CI job and in the pre-push hook |
| Nothing is pushed unchecked | `lefthook` pre-push runs `pnpm verify` |
| Only `packages/db` opens database connections | Biome `noRestrictedImports` on `pg` and `@neondatabase/serverless` |
| Migrations apply from empty and match the schema | `migrations` CI job (Postgres service) and `packages/db/test/migrate.test.ts` |
| Concurrent migration runs do not interleave | Advisory lock in `packages/db/src/migrate.ts` |
| A flush is never counted twice | `flush_log` primary key; `packages/db/test/store.test.ts` |
| Every route has a feature-map row | `pnpm check:features` in the `docs` CI job |
| Markdown links and anchors resolve | `pnpm check:docs` in the `docs` CI job |
| The custom checks can fail | `pnpm test:scripts` runs each against a fixture built to fail it |
| The right package manager and Node version | `packageManager` and `engines` in `package.json`; CI reads `.nvmrc` |
| Installs do not change the lockfile in CI | `pnpm install --frozen-lockfile` in the shared setup action |
| CI steps are pinned | Third-party actions referenced by commit hash; Dependabot moves them |
