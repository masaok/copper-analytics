---
name: verify
description: Run every check CI runs and report the real output. Use before saying work is done.
---

1. Run `pnpm verify` from the repo root. It runs lint, the script tests, the docs and feature-map checks, typecheck, tests and the production build.
2. Paste the tail of the output, including the test counts and the build's route table.
3. If a step fails, fix the cause. Never weaken a check or change a test to match wrong behavior.
4. If a step cannot run here, say which one and why. Do not skip it quietly.
5. For a change to a route in [docs/feature-map.md](../../../docs/feature-map.md), also drive that route with the command in its row and report what came back.
