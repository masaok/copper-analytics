import {
  type EventBuffer,
  type Filter,
  type FlushUnit,
  handlePageview,
  type ProjectDirectory,
  SHARD_COUNT,
  type Store,
  shardOf,
} from '@copper/core'
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

  const ingest = (request: Request) =>
    handlePageview(request, {
      projects: deps.projects,
      filter: deps.filter,
      bufferFor: (siteKey) => deps.shard(shardOf(siteKey)),
      ip: (req) => req.headers.get('CF-Connecting-IP') ?? '',
      country: (req) => (req as { cf?: { country?: string } }).cf?.country ?? '',
      clock: deps.clock,
      waitUntil: deps.waitUntil,
    })

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
    if (url.pathname === ROUTES.event) return ingest(request)
    if (url.pathname === ROUTES.health) return json({ ok: true })

    const authorized =
      !!deps.ingestSecret && request.headers.get('Authorization') === `Bearer ${deps.ingestSecret}`
    const isPrivate = [
      ROUTES.live,
      ROUTES.today,
      ROUTES.overview,
      ROUTES.invalidate,
      ROUTES.flush,
    ].includes(url.pathname as typeof ROUTES.live)
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
    if (url.pathname === ROUTES.overview) {
      // One call per shard, however many projects the page lists.
      const byShard = new Map<number, string[]>()
      for (const key of (url.searchParams.get('sites') ?? '')
        .split(',')
        .filter(Boolean)
        .slice(0, 1000)) {
        const index = shardOf(key)
        byShard.set(index, [...(byShard.get(index) ?? []), key])
      }
      const parts = await Promise.all(
        [...byShard].map(([index, keys]) => deps.shard(index).summary(keys)),
      )
      return json(Object.assign({}, ...parts))
    }
    const shard = deps.shard(shardOf(site))
    if (url.pathname === ROUTES.live) return json({ live: await shard.live(site) })
    return json(await shard.today(site))
  }

  return { fetch, runFlush }
}
