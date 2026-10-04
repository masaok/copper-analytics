import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../src/db'
import {
  breakdownFor,
  dailyRowsFor,
  overviewFor,
  ownersOf,
  seriesFor,
  totalsFor,
} from '../src/queries'
import { breakdownDaily, breakdownMonthly, statsDaily, statsHourly } from '../src/schema'
import { createTestDb } from '../src/testing'
import { seedProject } from './helpers'

let db: Db
let id: number
let other: number

beforeEach(async () => {
  ;({ db } = await createTestDb())
  id = await seedProject(db, 'aaaaaaaaaa')
  other = await seedProject(db, 'bbbbbbbbbb')
  const c = (n: number) => ({ pageviews: n * 10, visitors: n * 3, visits: n * 4, bounces: n })
  await db.insert(statsHourly).values([
    { projectId: id, hour: new Date('2026-10-04T09:00:00Z'), ...c(1) },
    { projectId: id, hour: new Date('2026-10-04T10:00:00Z'), ...c(2) },
    { projectId: id, hour: new Date('2026-10-04T12:00:00Z'), ...c(3) },
    { projectId: other, hour: new Date('2026-10-04T10:00:00Z'), ...c(9) },
  ])
  await db.insert(statsDaily).values([
    { projectId: id, day: '2026-08-31', ...c(1) },
    { projectId: id, day: '2026-09-01', ...c(2) },
    { projectId: id, day: '2026-09-30', ...c(3) },
    { projectId: id, day: '2026-10-04', ...c(4) },
    { projectId: other, day: '2026-10-04', ...c(9) },
  ])
  await db
    .insert(breakdownMonthly)
    .values([{ projectId: id, month: '2026-09-01', data: { page: { '/': [50, 20] } } }])
  await db.insert(breakdownDaily).values([
    { projectId: id, day: '2026-09-30', data: { page: { '/': [7, 3] } } },
    { projectId: id, day: '2026-10-03', data: { page: { '/': [4, 2], '/a': [1, 1] } } },
    { projectId: id, day: '2026-10-04', data: { page: { '/': [6, 3] }, country: { US: [6, 3] } } },
    { projectId: other, day: '2026-10-04', data: { page: { '/x': [99, 99] } } },
  ])
})

describe('seriesFor', () => {
  it('returns hourly points inside the span, for one project', async () => {
    const points = await seriesFor(db, id, 'hour', {
      from: '2026-10-04T10:00:00.000Z',
      to: '2026-10-04T12:00:00.000Z',
    })
    expect(points).toEqual([
      { bucket: '2026-10-04T10:00:00.000Z', pageviews: 20, visitors: 6, visits: 8, bounces: 2 },
      { bucket: '2026-10-04T12:00:00.000Z', pageviews: 30, visitors: 9, visits: 12, bounces: 3 },
    ])
  })

  it('returns daily points and groups them by month', async () => {
    const span = { from: '2026-08-31', to: '2026-10-04' }
    expect((await seriesFor(db, id, 'day', span)).map((p) => [p.bucket, p.pageviews])).toEqual([
      ['2026-08-31', 10],
      ['2026-09-01', 20],
      ['2026-09-30', 30],
      ['2026-10-04', 40],
    ])
    expect(await seriesFor(db, id, 'month', span)).toEqual([
      { bucket: '2026-08-01', pageviews: 10, visitors: 3, visits: 4, bounces: 1 },
      { bucket: '2026-09-01', pageviews: 50, visitors: 15, visits: 20, bounces: 5 },
      { bucket: '2026-10-01', pageviews: 40, visitors: 12, visits: 16, bounces: 4 },
    ])
  })
})

describe('totalsFor', () => {
  it('sums a span and returns zeros for an empty one', async () => {
    expect(await totalsFor(db, id, 'day', { from: '2026-09-01', to: '2026-09-30' })).toEqual({
      pageviews: 50,
      visitors: 15,
      visits: 20,
      bounces: 5,
    })
    expect(
      await totalsFor(db, id, 'hour', {
        from: '2026-10-04T09:00:00.000Z',
        to: '2026-10-04T10:00:00.000Z',
      }),
    ).toEqual({ pageviews: 30, visitors: 9, visits: 12, bounces: 3 })
    expect(await totalsFor(db, id, 'day', { from: '2020-01-01', to: '2020-01-02' })).toEqual({
      pageviews: 0,
      visitors: 0,
      visits: 0,
      bounces: 0,
    })
  })
})

describe('breakdownFor', () => {
  it('merges daily documents in the span', async () => {
    expect(await breakdownFor(db, id, 'daily', { from: '2026-10-03', to: '2026-10-04' })).toEqual({
      page: { '/': [10, 5], '/a': [1, 1] },
      country: { US: [6, 3] },
    })
  })

  it('uses the monthly document for rolled-up months and daily ones for the rest', async () => {
    // September comes from its monthly row (its daily row is not added again); October from daily rows.
    expect(await breakdownFor(db, id, 'monthly', { from: '2026-09-01', to: '2026-10-04' })).toEqual(
      {
        page: { '/': [60, 25], '/a': [1, 1] },
        country: { US: [6, 3] },
      },
    )
  })
})

describe('overview and export', () => {
  it('returns daily rows for several projects since a day', async () => {
    const rows = await overviewFor(db, [id, other], '2026-09-30')
    expect(rows).toEqual([
      { projectId: id, day: '2026-09-30', visitors: 9, pageviews: 30 },
      { projectId: id, day: '2026-10-04', visitors: 12, pageviews: 40 },
      { projectId: other, day: '2026-10-04', visitors: 27, pageviews: 90 },
    ])
    expect(await overviewFor(db, [], '2026-09-30')).toEqual([])
  })

  it('exports every daily row and finds project owners', async () => {
    expect((await dailyRowsFor(db, id)).map((r) => r.bucket)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-30',
      '2026-10-04',
    ])
    expect(await ownersOf(db, ['aaaaaaaaaa', 'bbbbbbbbbb', 'unknown000'])).toEqual(['u1'])
  })
})
