import {
  Aggregator,
  DAY_MS,
  type EventBuffer,
  type FlushUnit,
  type Hit,
  HOUR_MS,
  hourStart,
  type PageEvent,
  randomSalt,
  type TodaySnapshot,
  topOfHour,
  utcDayIndex,
  visitorId,
} from '@copper/core'

/** Durable storage behind a shard. SQLite in the Durable Object, a plain object in tests. */
export interface ShardStorage {
  getMeta(key: string): string | undefined
  setMeta(key: string, value: string): void
  appendBatch(firstTs: number, events: PageEvent[]): void
  /** Every stored batch, oldest first. */
  batches(): Iterable<PageEvent[]>
  deleteBatchesBefore(ts: number): void
}

export const BATCH_SIZE = 100
export const BATCH_INTERVAL_MS = 5000

/**
 * One shard's logic, free of the Durable Object runtime.
 *
 * Accepted events are counted in memory and appended to storage in micro-batches.
 * On start, the stored batches are replayed, which rebuilds the same counters,
 * sessions and seen-today sets a crash threw away.
 */
export class ShardCore implements EventBuffer {
  private readonly aggregator = new Aggregator()
  private unsaved: PageEvent[] = []
  private salt = ''
  private saltDay = -1
  /** Hours starting before this are already in the database. */
  private flushedThrough = 0

  constructor(
    private readonly storage: ShardStorage,
    private readonly clock: () => number = Date.now,
  ) {
    this.salt = storage.getMeta('salt') ?? ''
    this.saltDay = Number(storage.getMeta('saltDay') ?? -1)
    this.flushedThrough = Number(storage.getMeta('flushedThrough') ?? 0)
    const flushed = new Set<number>()
    for (const batch of storage.batches()) {
      for (const event of batch) {
        this.aggregator.add(event)
        if (event.t < this.flushedThrough) flushed.add(hourStart(event.t))
      }
    }
    this.aggregator.remove(flushed)
  }

  get hasUnsaved(): boolean {
    return this.unsaved.length > 0
  }

  async add(hit: Hit, dailyCap: number): Promise<boolean> {
    // An event that arrives after its hour was flushed is counted in the oldest open hour.
    const t = Math.max(hit.t, this.flushedThrough)
    const day = utcDayIndex(t)
    if (day !== this.saltDay) {
      this.salt = randomSalt()
      this.saltDay = day
      this.storage.setMeta('salt', this.salt)
      this.storage.setMeta('saltDay', String(day))
    }
    const { ip, ua, ...rest } = hit
    const event: PageEvent = { ...rest, t, v: await visitorId(this.salt, hit.k, ip, ua) }
    if (!this.aggregator.add(event, dailyCap)) return false
    this.unsaved.push(event)
    if (this.unsaved.length >= BATCH_SIZE) this.persist()
    return true
  }

  /** Writes the in-memory tail as one row. Called every few seconds and before a flush. */
  persist(): void {
    if (this.unsaved.length === 0) return
    this.storage.appendBatch((this.unsaved[0] as PageEvent).t, this.unsaved)
    this.unsaved = []
  }

  async live(siteKey: string): Promise<number> {
    return this.aggregator.live(siteKey, this.clock())
  }

  async today(siteKey: string): Promise<TodaySnapshot> {
    return this.aggregator.today(siteKey)
  }

  /** Every finished hour not yet acked. The flush id is the hour, so a retry reuses it. */
  async pending(now: number): Promise<FlushUnit[]> {
    this.persist()
    return this.aggregator.units(topOfHour(now)).map((unit) => {
      const hour = new Date(unit.hour).toISOString()
      return { flushId: hour, hour, projects: unit.projects }
    })
  }

  async ack(flushIds: string[]): Promise<void> {
    if (flushIds.length === 0) return
    const hours = flushIds.map((id) => Date.parse(id))
    this.aggregator.remove(hours)
    this.flushedThrough = Math.max(this.flushedThrough, ...hours.map((h) => h + HOUR_MS))
    this.storage.setMeta('flushedThrough', String(this.flushedThrough))
    // Today's batches stay: a restart replays them to rebuild sessions and seen-today sets.
    const now = this.clock()
    const startOfToday = utcDayIndex(now) * DAY_MS
    this.storage.deleteBatchesBefore(Math.min(startOfToday, this.flushedThrough))
    this.aggregator.prune(now)
  }
}

/** In-memory storage. Passing the same instance to a new ShardCore simulates a restart. */
export class MemoryShardStorage implements ShardStorage {
  readonly meta = new Map<string, string>()
  rows: { ts: number; events: PageEvent[] }[] = []

  getMeta(key: string) {
    return this.meta.get(key)
  }
  setMeta(key: string, value: string) {
    this.meta.set(key, value)
  }
  appendBatch(firstTs: number, events: PageEvent[]) {
    this.rows.push({ ts: firstTs, events: structuredClone(events) })
  }
  batches() {
    return this.rows.map((r) => r.events)
  }
  deleteBatchesBefore(ts: number) {
    this.rows = this.rows.filter((r) => r.ts >= ts)
  }
}
