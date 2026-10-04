import { sql } from 'drizzle-orm'
import { db, queryCount } from '@/lib/db'
import { env } from '@/lib/env'

/** Liveness for container health checks. With COPPER_DEBUG=1 it also reports the query count. */
export async function GET(request: Request) {
  const config = env()
  const body: Record<string, unknown> = { ok: true, mode: config.mode }
  if (new URL(request.url).searchParams.has('db')) await db().execute(sql`select 1`)
  if (config.debug) body.queries = queryCount()
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
