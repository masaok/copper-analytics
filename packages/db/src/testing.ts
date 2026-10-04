import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { Db } from './db'
import { runMigrations } from './migrate'
import { loadMigrations } from './migrations-dir'
import * as schema from './schema'

/** An in-process Postgres with every migration applied from empty. For tests and local scripts. */
export async function createTestDb(): Promise<{ db: Db; client: PGlite; applied: string[] }> {
  const client = new PGlite()
  const applied = await runMigrations(
    { query: (text, params) => client.query(text, params as unknown[]) },
    loadMigrations(),
  )
  return { db: drizzle(client, { schema }) as unknown as Db, client, applied }
}
