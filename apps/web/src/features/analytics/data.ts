import 'server-only'
import { unstable_cache } from 'next/cache'
import { googleApi, SCOPES } from '@/features/google/client'
import { daysBetween, searchWindow } from '@/features/google/ranges'
import type { ProjectSummary } from '@/features/projects/queries'
import { env } from '@/lib/env'
import {
  type AnalyticsProperty,
  type MatchedProperty,
  matchProperties,
  streamHosts,
} from './properties'

const ADMIN = 'https://analyticsadmin.googleapis.com/v1beta'
const DATA = 'https://analyticsdata.googleapis.com/v1beta'
/** Long enough to spare the quota, short enough that yesterday's numbers settle within the day. */
const LIFETIME = 3600

export interface AnalyticsTotals {
  users: number
  sessions: number
  views: number
  /** Share of sessions that were engaged, 0 to 1. */
  engagementRate: number
  /** Seconds. */
  sessionDuration: number
}

export interface AnalyticsRow {
  key: string
  /** Views for pages, sessions for sources. */
  value: number
  users: number
}

export interface PropertyReport {
  property: MatchedProperty
  totals: AnalyticsTotals
  /** Users per day, one entry for every day in the window. */
  daily: { day: string; users: number }[]
  pages: AnalyticsRow[]
  sources: AnalyticsRow[]
  error?: string
}

const admin = <T>(path: string) => googleApi<T>(SCOPES.analytics, `${ADMIN}${path}`)

/** Every property the service account can read, with the hosts of its web streams. */
const cachedProperties = unstable_cache(
  async (): Promise<AnalyticsProperty[]> => {
    const summaries: { property: string; displayName: string }[] = []
    let pageToken = ''
    do {
      const page = await admin<{
        accountSummaries?: { propertySummaries?: { property: string; displayName: string }[] }[]
        nextPageToken?: string
      }>(`/accountSummaries?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`)
      for (const account of page.accountSummaries ?? []) {
        summaries.push(...(account.propertySummaries ?? []))
      }
      pageToken = page.nextPageToken ?? ''
    } while (pageToken)
    return Promise.all(
      summaries.map(async ({ property, displayName }) => {
        const { dataStreams = [] } = await admin<{
          dataStreams?: { webStreamData?: { defaultUri?: string } }[]
        }>(`/${property}/dataStreams`)
        return {
          id: property,
          displayName,
          hosts: streamHosts(dataStreams.map((s) => s.webStreamData?.defaultUri)),
        }
      }),
    )
  },
  ['google-analytics', 'properties'],
  { revalidate: LIFETIME },
)

interface ApiReport {
  rows?: { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }[]
}

const metrics = (...names: string[]) => names.map((name) => ({ name }))
const top = (dimension: string, metric: string) => ({
  dimensions: [{ name: dimension }],
  metrics: metrics(metric, 'activeUsers'),
  orderBys: [{ metric: { metricName: metric }, desc: true }],
  limit: 10,
})
const rowsOf = (report: ApiReport | undefined): AnalyticsRow[] =>
  (report?.rows ?? []).map((r) => ({
    key: r.dimensionValues?.[0]?.value ?? '',
    value: Number(r.metricValues[0]?.value ?? 0),
    users: Number(r.metricValues[1]?.value ?? 0),
  }))

/** One property's numbers, in one batched call. A failure throws, and is not cached, so the next request retries. */
const cachedReport = (property: MatchedProperty, from: string, to: string) =>
  unstable_cache(
    async (): Promise<PropertyReport> => {
      const { reports = [] } = await googleApi<{ reports?: ApiReport[] }>(
        SCOPES.analytics,
        `${DATA}/${property.id}:batchRunReports`,
        {
          requests: [
            {
              metrics: metrics(
                'activeUsers',
                'sessions',
                'screenPageViews',
                'engagementRate',
                'averageSessionDuration',
              ),
            },
            { dimensions: [{ name: 'date' }], metrics: metrics('activeUsers'), limit: 400 },
            top('pagePath', 'screenPageViews'),
            top('sessionSourceMedium', 'sessions'),
          ].map((request) => ({ ...request, dateRanges: [{ startDate: from, endDate: to }] })),
        },
      )
      const [totals, byDay, pages, sources] = reports
      const t = totals?.rows?.[0]?.metricValues.map((m) => Number(m.value)) ?? []
      // Dates come back as YYYYMMDD.
      const days = new Map(
        rowsOf(byDay).map((r) => [
          `${r.key.slice(0, 4)}-${r.key.slice(4, 6)}-${r.key.slice(6)}`,
          r.value,
        ]),
      )
      return {
        property,
        totals: {
          users: t[0] ?? 0,
          sessions: t[1] ?? 0,
          views: t[2] ?? 0,
          engagementRate: t[3] ?? 0,
          sessionDuration: t[4] ?? 0,
        },
        daily: daysBetween(from, to).map((day) => ({ day, users: days.get(day) ?? 0 })),
        pages: rowsOf(pages),
        sources: rowsOf(sources),
      }
    },
    ['google-analytics', property.id, from, to],
    { revalidate: LIFETIME },
  )()

export interface GoogleAnalytics {
  window: { from: string; to: string }
  properties: PropertyReport[]
  error?: string
}

/**
 * Google Analytics data for each property with a web stream on one of the user's project domains.
 * Returns null when no service account is configured. A failing property reports its own error.
 */
export async function loadAnalytics(
  projects: ProjectSummary[],
  days: number,
): Promise<GoogleAnalytics | null> {
  if (!env().googleServiceAccount) return null
  const window = searchWindow(days)
  let all: AnalyticsProperty[]
  try {
    all = await cachedProperties()
  } catch (error) {
    return { window, properties: [], error: (error as Error).message }
  }
  const properties = await Promise.all(
    matchProperties(all, projects).map((property) =>
      cachedReport(property, window.from, window.to).catch(
        (error: Error): PropertyReport => ({
          property,
          totals: { users: 0, sessions: 0, views: 0, engagementRate: 0, sessionDuration: 0 },
          daily: [],
          pages: [],
          sources: [],
          error: error.message,
        }),
      ),
    ),
  )
  return { window, properties }
}
