import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import type { Db } from './db'
import * as schema from './schema'

/**
 * Neon over WebSocket, for Cloudflare Workers. Unlike the one-shot HTTP driver it
 * supports interactive transactions, which the idempotent flush needs.
 * Call `end()` before the request finishes.
 */
export function createNeonDb(url: string): { db: Db; end: () => Promise<void> } {
  const pool = new Pool({ connectionString: url })
  return { db: drizzle(pool, { schema }) as unknown as Db, end: () => pool.end() }
}
