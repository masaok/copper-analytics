# Agent guide

Copper Analytics is a cookieless traffic dashboard. This repo is the complete, self-hostable product. [docs/PLAN.md](docs/PLAN.md) is the design.

## Commands

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Everything CI runs | `pnpm verify` |
| Lint, read-only | `pnpm lint` |
| Lint with fixes (humans and agents, never hooks or CI) | `pnpm lint:fix` |
| One package's tests | `pnpm --filter @copper/core test` |
| New migration after a schema change | `pnpm --filter @copper/db generate` |
| Apply migrations | `DATABASE_URL=... pnpm --filter @copper/db migrate` |
| Local Postgres, nothing to install | `pnpm dev:db` |
| Demo account and 30 days of traffic | `DATABASE_URL=... pnpm seed` |

Run `pnpm verify` before you report work as done, and paste its output. If a step could not run, say which.

## Layout

| Path | Holds |
| --- | --- |
| `apps/web` | Next.js dashboard, auth and API routes |
| `apps/ingest` | Cloudflare Worker, Durable Object shards, hourly flush |
| `packages/core` | Pure logic with no I/O: aggregation, hashing, top-N merge, enrichment |
| `packages/db` | Drizzle schema, SQL migrations, the Postgres `Store` |
| `packages/tracker` | `c.js`, the browser script |
| `packages/ui` | Chart and table components |

`apps/web` uses a Next.js version with breaking changes. Read [apps/web/AGENTS.md](apps/web/AGENTS.md) before editing it.

## Rules

- Find the surface in [docs/feature-map.md](docs/feature-map.md) before changing it. A new route needs a new row in the same change, and CI fails without it.
- [docs/guardrails.md](docs/guardrails.md) lists each rule and what enforces it. Add a check before you add a sentence here.
- `packages/core` stays free of I/O and of Node-only APIs. It runs in Workers, Node and the browser.
- Change the schema in `packages/db/src/schema.ts`, then generate a migration. Never edit an applied migration.
- No secrets in the repo. `.env.example` lists every variable with no values.

## Trust

One pull request per phase or issue, with the verification output in the description. A human merges.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
