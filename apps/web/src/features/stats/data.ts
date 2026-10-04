import 'server-only'
import {
  addDays,
  type Breakdown,
  bucketsOf,
  type Counters,
  localDay,
  mergeBreakdown,
  monthOf,
  type RangeId,
  type ResolvedRange,
  resolveRange,
  type Span,
} from '@copper/core'
import { breakdownFor, overviewFor, type SeriesPoint, seriesFor, totalsFor } from '@copper/db'
import { unstable_cache } from 'next/cache'
import type { ProjectSummary } from '@/features/projects/queries'
import { liveSource } from '@/lib/buffer'
import { ownerTag, projectTag } from '@/lib/cache'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

/**
 * Edge mode invalidates by tag after each flush, so entries can live for hours.
 * Simple mode flushes in-process, outside any request, so it relies on a short lifetime.
 */
const lifetime = () => (env().mode === 'edge' ? 6 * 3600 : 60)

export interface Report {
  range: ResolvedRange
  totals: Counters
  previous: Counters
  series: SeriesPoint[]
  breakdown: Breakdown
  live: number
}

interface History {
  totals: Counters
  previous: Counters
  series: SeriesPoint[]
  breakdown: Breakdown
}

/** Everything a report needs from the database, cached until the project's next flush. */
function history(project: ProjectSummary, range: ResolvedRange, totalSpans: [Span, Span]) {
  const totalsGrain = range.id === 'today' ? 'day' : range.grain
  return unstable_cache(
    async (): Promise<History> => {
      const [totals, previous, series, breakdown] = await Promise.all([
        totalsFor(db(), project.id, totalsGrain, totalSpans[0]),
        totalsFor(db(), project.id, totalsGrain, totalSpans[1]),
        seriesFor(db(), project.id, range.grain, range.current),
        breakdownFor(db(), project.id, range.breakdownSource, range.days),
      ])
      return { totals, previous, series, breakdown }
    },
    [
      'report',
      project.siteKey,
      range.grain,
      range.current.from,
      range.current.to,
      totalSpans[0].from,
      totalSpans[1].from,
      range.breakdownSource,
    ],
    { tags: [projectTag(project.siteKey)], revalidate: lifetime() },
  )()
}

export async function loadReport(
  project: ProjectSummary,
  rangeId: RangeId,
  custom: { from?: string; to?: string },
  now = Date.now(),
): Promise<Report> {
  const range = resolveRange(rangeId, now, project.timezone, custom)
  const today = localDay(now, project.timezone)
  // "Today" compares whole days, so its visitor count is the day's unique visitors.
  const totalSpans: [Span, Span] =
    range.id === 'today'
      ? [
          { from: today, to: today },
          { from: addDays(today, -1), to: addDays(today, -1) },
        ]
      : [range.current, range.previous]

  const source = liveSource()
  const [stored, snapshot, live] = await Promise.all([
    history(project, range, totalSpans),
    range.includesNow ? source.today(project.siteKey) : null,
    source.live(project.siteKey),
  ])

  const byBucket = new Map(stored.series.map((p) => [p.bucket, { ...p }]))
  const totals = { ...stored.totals }
  const breakdown = mergeBreakdown({}, stored.breakdown)
  if (snapshot) {
    totals.pageviews += snapshot.pageviews
    totals.visits += snapshot.visits
    totals.bounces += snapshot.bounces
    totals.visitors +=
      range.grain === 'hour' && range.id !== 'today' ? snapshot.visitors : snapshot.dayVisitors
    mergeBreakdown(breakdown, snapshot.breakdown)
    for (const [hour, counters] of Object.entries(snapshot.hours)) {
      const day = localDay(Date.parse(hour), project.timezone)
      const bucket = range.grain === 'hour' ? hour : range.grain === 'day' ? day : monthOf(day)
      const point = byBucket.get(bucket) ?? {
        bucket,
        pageviews: 0,
        visitors: 0,
        visits: 0,
        bounces: 0,
      }
      point.pageviews += counters.pageviews
      point.visitors += counters.visitors
      point.visits += counters.visits
      point.bounces += counters.bounces
      byBucket.set(bucket, point)
    }
  }

  const series = bucketsOf(range.grain, range.current).map(
    (bucket) =>
      byBucket.get(bucket) ?? { bucket, pageviews: 0, visitors: 0, visits: 0, bounces: 0 },
  )
  return { range, totals, previous: stored.previous, series, breakdown, live }
}

export interface OverviewProject {
  project: ProjectSummary
  live: number
  todayVisitors: number
  todayPageviews: number
  yesterdayVisitors: number
  /** Visitors per day for the last 30 days, oldest first, today last. */
  trend: number[]
  pageviews30d: number
}

const TREND_DAYS = 30

/** One row per project. A repeat visit is served from the cache and the buffer, with no database query. */
export async function loadOverview(
  ownerId: string,
  projects: ProjectSummary[],
  now = Date.now(),
): Promise<OverviewProject[]> {
  // The earliest "30 days ago" in any timezone is covered by going back one extra day in UTC.
  const since = addDays(new Date(now).toISOString().slice(0, 10), -(TREND_DAYS + 1))
  const ids = projects.map((p) => p.id)
  const [rows, pending] = await Promise.all([
    unstable_cache(
      () => overviewFor(db(), ids, since),
      ['overview', ownerId, since, ids.join(',')],
      {
        tags: [ownerTag(ownerId)],
        revalidate: lifetime(),
      },
    )(),
    liveSource().summary(projects.map((p) => p.siteKey)),
  ])

  const byProject = new Map<number, Map<string, { visitors: number; pageviews: number }>>()
  for (const row of rows) {
    const days = byProject.get(row.projectId) ?? new Map()
    byProject.set(row.projectId, days)
    days.set(row.day, { visitors: row.visitors, pageviews: row.pageviews })
  }

  return projects.map((project) => {
    const days = byProject.get(project.id)
    const today = localDay(now, project.timezone)
    const unflushed = pending[project.siteKey] ?? { live: 0, pageviews: 0, dayVisitors: 0 }
    const trend: number[] = []
    let pageviews30d = unflushed.pageviews
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const day = days?.get(addDays(today, -i))
      trend.push((day?.visitors ?? 0) + (i === 0 ? unflushed.dayVisitors : 0))
      pageviews30d += day?.pageviews ?? 0
    }
    return {
      project,
      live: unflushed.live,
      todayVisitors: trend[TREND_DAYS - 1] ?? 0,
      todayPageviews: (days?.get(today)?.pageviews ?? 0) + unflushed.pageviews,
      yesterdayVisitors: trend[TREND_DAYS - 2] ?? 0,
      trend,
      pageviews30d,
    }
  })
}
