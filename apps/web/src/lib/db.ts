import 'server-only'
import type { Db } from '@copper/db'
import { createNodeDb, type NodeDb } from '@copper/db/node'
import { env } from './env'

const globals = globalThis as { __copperDb?: NodeDb; __copperQueries?: number }

/** Database queries since this process started. Read by /api/health when COPPER_DEBUG=1. */
export const queryCount = (): number => globals.__copperQueries ?? 0

export function db(): Db {
  globals.__copperDb ??= createNodeDb(env().DATABASE_URL, {
    onQuery: () => {
      globals.__copperQueries = (globals.__copperQueries ?? 0) + 1
    },
  })
  return globals.__copperDb.db
}
