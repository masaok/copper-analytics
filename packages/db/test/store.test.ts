import { OTHER } from '@copper/core'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../src/db'
import {
  breakdownDaily,
  breakdownMonthly,
  dbSizeLog,
  flushLog,
  statsDaily,
  statsHourly,
} from '../src/schema'
import { PgStore } from '../src/store'
import { createTestDb } from '../src/testing'
import { delta, seedProject, unit } from './helpers'

let db: Db
let store: PgStore

beforeEach(async () => {
  ;({ db } = await createTestDb())
  store = new PgStore(db)
})

describe('applyFlush', () => {
  it('writes hourly, daily and breakdown rows with the totals it was given', async () => {
    const id = await seedProject(db, 'aaaaaaaaaa')
    const result = await store.applyFlush(3, [
      unit('2026-10-04T10:00:00.000Z', [delta('aaaaaaaaaa')]),
      unit('2026-10-04T11:00:00.000Z', [delta('aaaaaaaaaa', { pageviews: 1, bounces: -1 })]),
    ])
    expect(result).toEqual({
      applied: ['2026-10-04T10:00:00.000Z', '2026-10-04T11:00:00.000Z'],
      skipped: [],
    })
    const hourly = await db.select().from(statsHourly).orderBy(statsHourly.hour)
    expect(hourly.map((h) => [h.pageviews, h.visitors, h.visits, h.bounces])).toEqual([
      [10, 4, 5, 2],
      [1, 4, 5, -1],
    ])
    expect(await db.select().from(statsDaily)).toEqual([
      { projectId: id, day: '2026-10-04', pageviews: 11, visitors: 6, visits: 10, bounces: 1 },
    ])
    const [b] = await db.select().from(breakdownDaily)
    expect(b?.data).toEqual({
      page: { '/': [14, 6], '/pricing': [6, 4] },
      country: { US: [20, 6] },
    })
  })

  it('does not double count a replayed flush', async () => {
    await seedProject(db, 'aaaaaaaaaa')
    const units = [unit('2026-10-04T10:00:00.000Z', [delta('aaaaaaaaaa')])]
    await store.applyFlush(3, units)
    const replay = await store.applyFlush(3, units)
    expect(replay).toEqual({ applied: [], skipped: ['2026-10-04T10:00:00.000Z'] })
    const [daily] = await db.select().from(statsDaily)
    expect(daily?.pageviews).toBe(10)
    const [b] = await db.select().from(breakdownDaily)
    expect(b?.data.page?.['/']).toEqual([7, 3])
    expect(await db.select().from(flushLog)).toHaveLength(1)
  })

  it('applies the new hour and skips the old one when a retry carries both', async () => {
    await seedProject(db, 'aaaaaaaaaa')
    const first = unit('2026-10-04T10:00:00.000Z', [delta('aaaaaaaaaa')])
    await store.applyFlush(0, [first])
    const result = await store.applyFlush(0, [
      first,
      unit('2026-10-04T11:00:00.000Z', [delta('aaaaaaaaaa')]),
    ])
    expect(result.skipped).toEqual(['2026-10-04T10:00:00.000Z'])
    expect(result.applied).toEqual(['2026-10-04T11:00:00.000Z'])
    const [daily] = await db.select().from(statsDaily)
    expect(daily?.pageviews).toBe(20)
  })

  it('treats the same flush id on another shard as a different flush', async () => {
    await seedProject(db, 'aaaaaaaaaa')
    await seedProject(db, 'bbbbbbbbbb')
    await store.applyFlush(0, [unit('2026-10-04T10:00:00.000Z', [delta('aaaaaaaaaa')])])
    const other = await store.applyFlush(1, [
      unit('2026-10-04T10:00:00.000Z', [delta('bbbbbbbbbb')]),
    ])
    expect(other.applied).toHaveLength(1)
    expect(await db.select().from(statsHourly)).toHaveLength(2)
  })

  it('rolls the whole flush back when a write fails, so a retry applies it once', async () => {
    await seedProject(db, 'aaaaaaaaaa')
    const broken = delta('aaaaaaaaaa', { pageviews: Number.NaN })
    const hour = '2026-10-04T10:00:00.000Z'
    await expect(store.applyFlush(0, [unit(hour, [broken])])).rejects.toThrow()
    expect(await db.select().from(flushLog)).toHaveLength(0)
    expect(await db.select().from(statsHourly)).toHaveLength(0)
    const retry = await store.applyFlush(0, [unit(hour, [delta('aaaaaaaaaa')])])
    expect(retry.applied).toEqual([hour])
  })

  it("buckets an hour into the project's local day", async () => {
    await seedProject(db, 'aaaaaaaaaa', { timezone: 'America/Los_Angeles' })
    await seedProject(db, 'bbbbbbbbbb')
    await store.applyFlush(0, [
      unit('2026-10-05T03:00:00.000Z', [delta('aaaaaaaaaa'), delta('bbbbbbbbbb')]),
    ])
    const days = await db.select().from(statsDaily).orderBy(statsDaily.projectId)
    expect(days.map((d) => d.day)).toEqual(['2026-10-04', '2026-10-05'])
  })

  it('adds two partial units for the same hour', async () => {
    await seedProject(db, 'aaaaaaaaaa')
    const hour = '2026-10-04T10:00:00.000Z'
    await store.applyFlush(0, [
      unit(hour, [delta('aaaaaaaaaa')], `${hour}#1`),
      unit(hour, [delta('aaaaaaaaaa')], `${hour}#2`),
    ])
    const [h] = await db.select().from(statsHourly)
    expect(h?.pageviews).toBe(20)
  })

  it('ignores site keys it does not know and still records the flush', async () => {
    const result = await store.applyFlush(0, [
      unit('2026-10-04T10:00:00.000Z', [delta('zzzzzzzzzz')]),
    ])
    expect(result.applied).toHaveLength(1)
    expect(await db.select().from(statsHourly)).toHaveLength(0)
  })

  it('keeps the daily breakdown at 50 entries per dimension plus (other)', async () => {
    await seedProject(db, 'aaaaaaaaaa')
    const pages = (from: number) =>
      Object.fromEntries(
        Array.from({ length: 40 }, (_, i) => [`/p${from + i}`, [from + i + 1, 1]]),
      ) as Record<string, [number, number]>
    await store.applyFlush(0, [
      unit('2026-10-04T10:00:00.000Z', [delta('aaaaaaaaaa', { breakdown: { page: pages(0) } })]),
      unit('2026-10-04T11:00:00.000Z', [delta('aaaaaaaaaa', { breakdown: { page: pages(40) } })]),
    ])
    const [b] = await db.select().from(breakdownDaily)
    const page = b?.data.page ?? {}
    expect(Object.keys(page)).toHaveLength(51)
    // The 30 smallest pages (1..30 pageviews) fold into (other).
    expect(page[OTHER]).toEqual([465, 30])
  })
})

describe('projectConfig', () => {
  it('returns domains and cap, and hides unknown or disabled projects', async () => {
    await seedProject(db, 'aaaaaaaaaa', { domains: ['acme.io'], dailyCap: 77 })
    await seedProject(db, 'bbbbbbbbbb', { disabled: true })
    expect(await store.projectConfig('aaaaaaaaaa')).toEqual({
      siteKey: 'aaaaaaaaaa',
      domains: ['acme.io'],
      dailyCap: 77,
    })
    expect(await store.projectConfig('bbbbbbbbbb')).toBeNull()
    expect(await store.projectConfig('cccccccccc')).toBeNull()
  })
})

describe('runDaily', () => {
  it('applies retention, rolls finished months up and records the database size', async () => {
    const id = await seedProject(db, 'aaaaaaaaaa')
    const now = new Date('2026-10-04T00:05:00.000Z')
    await db.insert(statsHourly).values([
      { projectId: id, hour: new Date('2026-09-19T00:00:00Z'), pageviews: 1 },
      { projectId: id, hour: new Date('2026-09-21T00:00:00Z'), pageviews: 1 },
    ])
    await db.insert(breakdownDaily).values([
      { projectId: id, day: '2026-07-05', data: { page: { '/old': [1, 1] } } },
      { projectId: id, day: '2026-09-10', data: { page: { '/': [5, 2] } } },
      { projectId: id, day: '2026-09-11', data: { page: { '/': [3, 1], '/b': [1, 1] } } },
      { projectId: id, day: '2026-10-02', data: { page: { '/': [9, 9] } } },
    ])
    await db.insert(breakdownMonthly).values([
      { projectId: id, month: '2024-08-01', data: {} },
      { projectId: id, month: '2024-09-01', data: {} },
    ])
    await db.insert(flushLog).values([
      { shard: 0, flushId: 'old', flushedAt: new Date('2026-09-01T00:00:00Z') },
      { shard: 0, flushId: 'new', flushedAt: new Date('2026-10-03T00:00:00Z') },
    ])

    const report = await store.runDaily(now)
    expect(report.deleted).toEqual({
      statsHourly: 1,
      breakdownDaily: 1,
      breakdownMonthly: 1,
      flushLog: 1,
    })
    expect(report.monthsRolled).toBe(2)
    expect(report.databaseBytes).toBeGreaterThan(1_000_000)

    const monthly = await db.select().from(breakdownMonthly).orderBy(breakdownMonthly.month)
    expect(monthly.map((m) => m.month)).toEqual(['2024-09-01', '2026-07-01', '2026-09-01'])
    expect(monthly[2]?.data).toEqual({ page: { '/': [8, 3], '/b': [1, 1] } })
    expect(await db.select().from(dbSizeLog)).toMatchObject([{ day: '2026-10-04' }])

    // A second run the same day changes nothing more.
    const again = await store.runDaily(now)
    expect(again.monthsRolled).toBe(0)
    expect(again.deleted.statsHourly).toBe(0)
    expect(await db.select().from(dbSizeLog)).toHaveLength(1)
  })
})
