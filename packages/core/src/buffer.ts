import { Aggregator } from './aggregator'
import type { Hit } from './enrich'
import { randomSalt, visitorId } from './hash'
import { utcDayIndex } from './time'
import type { FlushUnit, ProjectConfig, TodaySnapshot } from './types'

/**
 * Where pageviews wait between arriving and being written to the database.
 * Implemented in memory here and by the Durable Object shards in `apps/ingest`.
 */
export interface EventBuffer {
  /** Counts a pageview. Returns false when the project's daily cap drops it. */
  add(hit: Hit, dailyCap: number): Promise<boolean>
  live(siteKey: string): Promise<number>
  today(siteKey: string): Promise<TodaySnapshot>
  /** Units ready to store. Each stays buffered, with the same id, until it is acked. */
  pending(now: number): Promise<FlushUnit[]>
  ack(flushIds: string[]): Promise<void>
}

export interface DailyReport {
  day: string
  deleted: {
    statsHourly: number
    breakdownDaily: number
    breakdownMonthly: number
    flushLog: number
  }
  monthsRolled: number
  databaseBytes: number
}

export interface FlushResult {
  applied: string[]
  skipped: string[]
}

/** The durable side: rollups in Postgres. */
export interface Store {
  projectConfig(siteKey: string): Promise<ProjectConfig | null>
  /** Applies units in one transaction. A unit whose id was already applied is skipped, never added twice. */
  applyFlush(shard: number, units: FlushUnit[]): Promise<FlushResult>
  /** Retention deletes, monthly rollups and a database-size reading. Safe to run more than once a day. */
  runDaily(now: Date): Promise<DailyReport>
}

/** Moves everything ready from a buffer into the store. Units are acked only after the commit. */
export async function flush(
  buffer: EventBuffer,
  store: Store,
  shard: number,
  now: number,
): Promise<FlushResult> {
  const units = await buffer.pending(now)
  if (units.length === 0) return { applied: [], skipped: [] }
  const result = await store.applyFlush(shard, units)
  await buffer.ack([...result.applied, ...result.skipped])
  return result
}

/**
 * Single-process buffer for simple mode. It flushes partial hours, so each
 * pending unit gets a random id and is kept until the store confirms it.
 * A restart loses whatever has not been flushed.
 */
export class MemoryBuffer implements EventBuffer {
  private readonly aggregator = new Aggregator()
  private readonly unacked = new Map<string, FlushUnit>()
  private salt = randomSalt()
  private saltDay = -1

  constructor(private readonly clock: () => number = Date.now) {}

  async add(hit: Hit, dailyCap: number): Promise<boolean> {
    const day = utcDayIndex(hit.t)
    if (day !== this.saltDay) {
      this.salt = randomSalt()
      this.saltDay = day
    }
    const { ip, ua, ...event } = hit
    return this.aggregator.add({ ...event, v: await visitorId(this.salt, hit.k, ip, ua) }, dailyCap)
  }

  async live(siteKey: string): Promise<number> {
    return this.aggregator.live(siteKey, this.clock())
  }

  async today(siteKey: string): Promise<TodaySnapshot> {
    return this.aggregator.today(siteKey)
  }

  async pending(now: number): Promise<FlushUnit[]> {
    const units = this.aggregator.units()
    this.aggregator.remove(units.map((u) => u.hour))
    this.aggregator.prune(now)
    for (const unit of units) {
      const hour = new Date(unit.hour).toISOString()
      const flushId = `${hour}#${crypto.randomUUID()}`
      this.unacked.set(flushId, { flushId, hour, projects: unit.projects })
    }
    return [...this.unacked.values()]
  }

  async ack(flushIds: string[]): Promise<void> {
    for (const id of flushIds) this.unacked.delete(id)
  }
}

export type { ProjectConfig }
