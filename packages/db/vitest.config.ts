import { defineConfig } from 'vitest/config'

// Each test starts an in-process Postgres, which takes seconds on a hosted runner.
export default defineConfig({ test: { testTimeout: 30_000 } })
