import {
  defaultFilter,
  HOUR_MS,
  type PageEvent,
  SESSION_MS,
  SHARD_COUNT,
  syntheticEvents,
} from '@copper/core'
import { PgStore, schema } from '@copper/db'
import { createTestDb } from '@copper/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { ProjectDirectory } from '../src/projects'
import { MemoryShardStorage, ShardCore } from '../src/shard-core'

const T0 = Date.UTC(2026, 9, 5, 3, 0, 0)
const SITES = [
  { siteKey: 'pipeutc001', timezone: 'UTC', visitsPerDay: 30000, seed: 11 },
  { siteKey: 'pipela0002', timezone: 'America/Los_Angeles', visitsPerDay: 14000, seed: 12 },
]

/** Totals counted straight from the raw events, without the aggregator. */
function expectedTotals(events: PageEvent[]) {
  const byVisitor = new Map<string, number[]>()
  const pages = new Map<string, number>()
  for (const e of events) {
    byVisitor.set(e.v, [...(byVisitor.get(e.v) ?? []), e.t])
    pages.set(e.p, (pages.get(e.p) ?? 0) + 1)
  }
  let visits = 0
  let bounces = 0
  for (const times of byVisitor.values()) {
    let sessionSize = 0
    times.forEach((t, i) => {
      if (i === 0 || t - (times[i - 1] as number) > SESSION_MS) {
        if (sessionSize === 1) bounces++
        visits++
        sessionSize = 0
      }
      sessionSize++
    })
    if (sessionSize === 1) bounces++
  }
  return { pageviews: events.length, visitors: byVisitor.size, visits, bounces, pages }
}

describe('one hour of traffic, end to end', () => {
  it('lands in stats_hourly, stats_daily and breakdown_daily with the right totals', async () => {
    const { db } = await createTestDb()
    await db.insert(schema.user).values({ id: 'u', name: 'U', email: 'u@example.com' })
    await db.insert(schema.project).values(
      SITES.map((s) => ({
        siteKey: s.siteKey,
        timezone: s.timezone,
        name: s.siteKey,
        ownerId: 'u',
      })),
    )

    let now = T0
    const shards = Array.from(
      { length: SHARD_COUNT },
      () => new ShardCore(new MemoryShardStorage(), () => now),
    )
    const store = new PgStore(db)
    const app = createApp({
      projects: new ProjectDirectory((key) => store.projectConfig(key)),
      filter: defaultFilter,
      shard: (i) => shards[i] as ShardCore,
      openStore: async () => ({ store, close: async () => {} }),
      ingestSecret: 's',
      clock: () => now,
    })

    const expected = new Map<string, ReturnType<typeof expectedTotals>>()
    for (const site of SITES) {
      const events = [...syntheticEvents({ ...site, from: T0, to: T0 + HOUR_MS })]
      expect(events.length).toBeGreaterThan(100)
      expected.set(site.siteKey, expectedTotals(events))
      for (const e of events) {
        now = e.t
        // Each synthetic visitor gets its own address; the page URL carries the path and UTM tag.
        const res = await app.fetch(
          new Request('https://e.test/e', {
            method: 'POST',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
              'CF-Connecting-IP': e.v,
            },
            body: JSON.stringify({ s: e.k, u: `https://${e.k}.test${e.p}` }),
          }),
        )
        expect(res.status).toBe(204)
      }
    }

    now = T0 + HOUR_MS + 5 * 60_000
    const report = await app.runFlush()
    expect(report.failed).toEqual([])
    expect(report.siteKeys.sort()).toEqual(SITES.map((s) => s.siteKey).sort())

    for (const site of SITES) {
      const want = expected.get(site.siteKey) as ReturnType<typeof expectedTotals>
      const [project] = await db
        .select()
        .from(schema.project)
        .where(eq(schema.project.siteKey, site.siteKey))
      const id = (project as { id: number }).id
      const counters = {
        pageviews: want.pageviews,
        visitors: want.visitors,
        visits: want.visits,
        bounces: want.bounces,
      }
      expect(
        await db.select().from(schema.statsHourly).where(eq(schema.statsHourly.projectId, id)),
      ).toEqual([{ projectId: id, hour: new Date(T0), ...counters }])
      // 03:00 UTC on Oct 5 is still Oct 4 in Los Angeles.
      const day = site.timezone === 'UTC' ? '2026-10-05' : '2026-10-04'
      expect(
        await db.select().from(schema.statsDaily).where(eq(schema.statsDaily.projectId, id)),
      ).toEqual([{ projectId: id, day, ...counters }])
      const [breakdown] = await db
        .select()
        .from(schema.breakdownDaily)
        .where(eq(schema.breakdownDaily.projectId, id))
      expect(breakdown?.day).toBe(day)
      const pages = breakdown?.data.page ?? {}
      expect(Object.fromEntries(Object.entries(pages).map(([p, [pv]]) => [p, pv]))).toEqual(
        Object.fromEntries(want.pages),
      )
      expect(Object.values(breakdown?.data.browser ?? {})).toEqual([
        [want.pageviews, want.visitors],
      ])
    }

    // Running the flush again finds nothing and writes nothing.
    const again = await app.runFlush()
    expect(again).toMatchObject({ shards: 0, applied: 0 })
    expect(await db.select().from(schema.flushLog)).toHaveLength(report.applied)
  })
})
