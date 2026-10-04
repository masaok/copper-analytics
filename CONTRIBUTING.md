# Contributing

The process for people. Rules for agents are in [AGENTS.md](AGENTS.md), and each rule's enforcement is in [docs/guardrails.md](docs/guardrails.md).

## Set up

```bash
nvm use        # Node from .nvmrc
pnpm install   # also installs the git hooks
pnpm dev:db    # local Postgres, nothing to install
```

Copy `.env.example` to `apps/web/.env.local` and fill it in.

## Hooks

| Hook | Runs | Takes |
| --- | --- | --- |
| `.husky/pre-commit` | `lint-staged`: Biome formats the staged files and re-stages them | About a second |
| `.husky/pre-push` | `pnpm check`, then `pnpm build`: the same commands CI runs | A minute or so |

Do not bypass them with `--no-verify`. CI runs the same checks and is the gate.

## Pull requests

One pull request per phase or issue. Paste the output of `pnpm verify` into the description. A human merges.

`pnpm lint` only reports. `pnpm lint:fix` rewrites files, and is for you to run by hand, never a hook or CI.
