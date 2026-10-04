import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import type { Db } from './db'
import * as schema from './schema'

export interface NodeDb {
  db: Db
  pool: pg.Pool
}

/** Connection pool for a long-lived Node process or a serverless function. Works with any Postgres. */
export function createNodeDb(
  url: string,
  options: { max?: number; onQuery?: (sql: string) => void } = {},
): NodeDb {
  const pool = new pg.Pool({ connectionString: url, max: options.max ?? 5 })
  const logger = options.onQuery ? { logQuery: options.onQuery } : undefined
  return { db: drizzle(pool, { schema, logger }) as unknown as Db, pool }
}
