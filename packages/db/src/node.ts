import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import type { Db } from './db'
import { runMigrations } from './migrate'
import { loadMigrations } from './migrations-dir'
import * as schema from './schema'

export interface NodeDb {
  db: Db
  pool: pg.Pool
}

/** Connection pool for a long-lived Node process or a serverless function. Works with any Postgres. */
export function createNodeDb(url: string, max = 5): NodeDb {
  const pool = new pg.Pool({ connectionString: url, max })
  return { db: drizzle(pool, { schema }) as unknown as Db, pool }
}

export async function migrate(url: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await runMigrations(client, loadMigrations())
  } finally {
    await client.end()
  }
}

export { loadMigrations, MIGRATIONS_DIR } from './migrations-dir'
