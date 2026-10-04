import {
  type EventBuffer,
  type Filter,
  type FlushUnit,
  parsePayload,
  SHARD_COUNT,
  type Store,
  shardOf,
  toHit,
} from '@copper/core'
import type { ProjectDirectory } from './projects'
import { ROUTES } from './routes'

export interface AppDeps {
  projects: ProjectDirectory
  filter: Filter
  shard(index: number): EventBuffer
  /** Opens the database only when called, so an idle hour never wakes it. */
  openStore(): Promise<{ store: Store; close(): Promise<void> }>
  ingestSecret?: string
  /** Tells the web app which projects have new data. */
  revalidate?(siteKeys: string[]): Promise<void>
  clock?: () => number
  /** Keeps work running after the response is sent. */
  waitUntil?(work: Promise<unknown>): void
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}
const accepted = () => new Response(null, { status: 204, headers: CORS })
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export interface FlushReport {
  shards: number
  applied: number
  skipped: number
  siteKeys: string[]
  failed: { shard: number; error: string }[]
  daily?: unknown
}

export function createApp(deps: AppDeps) {
  const now = () => (deps.clock ?? Date.now)()

  async function ingest(request: Request): Promise<Response> {
    let body: unknown
    try {
      body = JSON.parse(await request.text())
    } catch {
      return accepted()
    }
    const payload = parsePayload(body)
    // Every rejection answers 204: a caller learns nothing about which site keys exist.
    if (!payload) return accepted()
    const project = await deps.projects.get(payload.s)
    if (!project) return accepted()

    const userAgent = request.headers.get('User-Agent') ?? ''
    const ip = request.headers.get('CF-Connecting-IP') ?? ''
    const reason = deps.filter.reject({
      userAgent,
      origin: request.headers.get('Origin') ?? payload.u,
      ip,
      referrer: payload.r ?? '',
      project,
    })
    if (reason) return accepted()

    const country = (request as { cf?: { country?: string } }).cf?.country ?? ''
    const hit = toHit(payload, { userAgent, ip, country, now: now() })
    const work = deps.shard(shardOf(hit.k)).add(hit, project.dailyCap)
    if (deps.waitUntil) deps.waitUntil(work)
    else await work
    return accepted()
  }

  /** Moves every finished hour from the shards into the database. The cron and POST /flush both call this. */
  async function runFlush(options: { daily?: boolean } = {}): Promise<FlushReport> {
    const at = now()
    const report: FlushReport = { shards: 0, applied: 0, skipped: 0, siteKeys: [], failed: [] }
    const ready: { index: number; shard: EventBuffer; units: FlushUnit[] }[] = []
    for (let index = 0; index < SHARD_COUNT; index++) {
      const shard = deps.shard(index)
      const units = await shard.pending(at)
      if (units.length > 0) ready.push({ index, shard, units })
    }
    if (ready.length === 0 && !options.daily) return report

    const { store, close } = await deps.openStore()
    try {
      const siteKeys = new Set<string>()
      for (const { index, shard, units } of ready) {
        try {
          const result = await store.applyFlush(index, units)
          // Ack only after the commit, so a failed write leaves the hour buffered.
          await shard.ack([...result.applied, ...result.skipped])
          report.shards++
          report.applied += result.applied.length
          report.skipped += result.skipped.length
          for (const unit of units) for (const p of unit.projects) siteKeys.add(p.siteKey)
        } catch (error) {
          // One shard's failure leaves its data buffered for the next run and does not block the rest.
          report.failed.push({ shard: index, error: (error as Error).message })
        }
      }
      report.siteKeys = [...siteKeys]
      if (options.daily) report.daily = await store.runDaily(new Date(at))
    } finally {
      await close()
    }
    if (report.siteKeys.length > 0) await deps.revalidate?.(report.siteKeys).catch(() => {})
    return report
  }

  async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === ROUTES.event) {
      if (request.method === 'OPTIONS') return accepted()
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: CORS })
      return ingest(request)
    }
    if (url.pathname === ROUTES.health) return json({ ok: true })

    const authorized =
      !!deps.ingestSecret && request.headers.get('Authorization') === `Bearer ${deps.ingestSecret}`
    const isPrivate = [ROUTES.live, ROUTES.today, ROUTES.invalidate, ROUTES.flush].includes(
      url.pathname as typeof ROUTES.live,
    )
    if (!isPrivate) return new Response('Not found', { status: 404 })
    if (!authorized) return new Response('Unauthorized', { status: 401 })

    if (url.pathname === ROUTES.flush && request.method === 'POST') {
      return json(await runFlush({ daily: url.searchParams.has('daily') }))
    }
    const site = url.searchParams.get('site') ?? ''
    if (url.pathname === ROUTES.invalidate && request.method === 'POST') {
      await deps.projects.invalidate(site)
      return json({ ok: true })
    }
    if (request.method !== 'GET') return new Response(null, { status: 405 })
    const shard = deps.shard(shardOf(site))
    if (url.pathname === ROUTES.live) return json({ live: await shard.live(site) })
    return json(await shard.today(site))
  }

  return { fetch, runFlush }
}
