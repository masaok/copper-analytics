import {
  type Breakdown,
  type Counters,
  type Grain,
  mergeBreakdown,
  monthOf,
  type Span,
} from '@copper/core'
import { and, asc, between, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { Db } from './db'
import { breakdownDaily, breakdownMonthly, project, statsDaily, statsHourly } from './schema'

export interface SeriesPoint extends Counters {
  /** ISO instant for hour grain, `YYYY-MM-DD` for day and month grain. */
  bucket: string
}

const sum = (column: unknown) => sql<number>`coalesce(sum(${column}), 0)::int`

/** Counters per bucket. Buckets with no traffic are absent; the caller fills them in. */
export async function seriesFor(
  db: Db,
  projectId: number,
  grain: Grain,
  span: Span,
): Promise<SeriesPoint[]> {
  if (grain === 'hour') {
    const rows = await db
      .select()
      .from(statsHourly)
      .where(
        and(
          eq(statsHourly.projectId, projectId),
          between(statsHourly.hour, new Date(span.from), new Date(span.to)),
        ),
      )
      .orderBy(asc(statsHourly.hour))
    return rows.map(({ hour, pageviews, visitors, visits, bounces }) => ({
      bucket: hour.toISOString(),
      pageviews,
      visitors,
      visits,
      bounces,
    }))
  }
  const inSpan = and(
    eq(statsDaily.projectId, projectId),
    between(statsDaily.day, span.from, span.to),
  )
  if (grain === 'day') {
    const rows = await db.select().from(statsDaily).where(inSpan).orderBy(asc(statsDaily.day))
    return rows.map(({ day, pageviews, visitors, visits, bounces }) => ({
      bucket: day,
      pageviews,
      visitors,
      visits,
      bounces,
    }))
  }
  const month = sql<string>`date_trunc('month', ${statsDaily.day})::date::text`
  return db
    .select({
      bucket: month,
      pageviews: sum(statsDaily.pageviews),
      visitors: sum(statsDaily.visitors),
      visits: sum(statsDaily.visits),
      bounces: sum(statsDaily.bounces),
    })
    .from(statsDaily)
    .where(inSpan)
    .groupBy(month)
    .orderBy(month)
}

/** Summed counters over a span. Visitors are a sum of per-bucket uniques, not a deduplicated count. */
export async function totalsFor(
  db: Db,
  projectId: number,
  grain: Grain,
  span: Span,
): Promise<Counters> {
  const table = grain === 'hour' ? statsHourly : statsDaily
  const where =
    grain === 'hour'
      ? and(
          eq(statsHourly.projectId, projectId),
          between(statsHourly.hour, new Date(span.from), new Date(span.to)),
        )
      : and(eq(statsDaily.projectId, projectId), between(statsDaily.day, span.from, span.to))
  const [row] = await db
    .select({
      pageviews: sum(table.pageviews),
      visitors: sum(table.visitors),
      visits: sum(table.visits),
      bounces: sum(table.bounces),
    })
    .from(table)
    .where(where)
  return row ?? { pageviews: 0, visitors: 0, visits: 0, bounces: 0 }
}

/**
 * Merged breakdown for a span of local days. `monthly` reads whole-month documents
 * and fills in months that are not rolled up yet from the daily ones.
 */
export async function breakdownFor(
  db: Db,
  projectId: number,
  source: 'daily' | 'monthly',
  days: Span,
): Promise<Breakdown> {
  const merged: Breakdown = {}
  const rolled = new Set<string>()
  if (source === 'monthly') {
    const months = await db
      .select()
      .from(breakdownMonthly)
      .where(
        and(
          eq(breakdownMonthly.projectId, projectId),
          gte(breakdownMonthly.month, monthOf(days.from)),
          lte(breakdownMonthly.month, days.to),
        ),
      )
    for (const row of months) {
      rolled.add(row.month)
      mergeBreakdown(merged, row.data)
    }
  }
  const daily = await db
    .select()
    .from(breakdownDaily)
    .where(
      and(eq(breakdownDaily.projectId, projectId), between(breakdownDaily.day, days.from, days.to)),
    )
  for (const row of daily) {
    if (!rolled.has(monthOf(row.day))) mergeBreakdown(merged, row.data)
  }
  return merged
}

export interface OverviewRow {
  projectId: number
  day: string
  visitors: number
  pageviews: number
}

/** Daily visitors and pageviews for many projects since a day. One query for the whole overview. */
export async function overviewFor(
  db: Db,
  projectIds: number[],
  sinceDay: string,
): Promise<OverviewRow[]> {
  if (projectIds.length === 0) return []
  return db
    .select({
      projectId: statsDaily.projectId,
      day: statsDaily.day,
      visitors: statsDaily.visitors,
      pageviews: statsDaily.pageviews,
    })
    .from(statsDaily)
    .where(and(inArray(statsDaily.projectId, projectIds), gte(statsDaily.day, sinceDay)))
    .orderBy(asc(statsDaily.day))
}

/** Every daily row for a project, oldest first. Backs the CSV export. */
export const dailyRowsFor = (db: Db, projectId: number): Promise<SeriesPoint[]> =>
  seriesFor(db, projectId, 'day', { from: '0001-01-01', to: '9999-12-31' })

/** Owners of the given site keys, so a flush can invalidate each owner's overview. */
export async function ownersOf(db: Db, siteKeys: string[]): Promise<string[]> {
  if (siteKeys.length === 0) return []
  const rows = await db
    .selectDistinct({ ownerId: project.ownerId })
    .from(project)
    .where(inArray(project.siteKey, siteKeys))
  return rows.map((r) => r.ownerId)
}
