import { defineConfig } from 'drizzle-kit'

// Used only to generate SQL from the schema. Migrations are applied by `pnpm --filter @copper/db migrate`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
})
