import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { 'copper-filter': fileURLToPath(new URL('./src/filter.ts', import.meta.url)) },
  },
})
