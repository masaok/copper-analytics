/** Every breakdown dimension, in the order used for compact keys. The one list queries, storage and UI share. */
export const DIMENSIONS = [
  'page',
  'referrer',
  'country',
  'device',
  'browser',
  'os',
  'utm_source',
] as const
export type Dimension = (typeof DIMENSIONS)[number]

/** `[pageviews, visitors]` for one value of one dimension. */
export type Tally = [pageviews: number, visitors: number]
export type Breakdown = Partial<Record<Dimension, Record<string, Tally>>>

export const OTHER = '(other)'
export const DIRECT = '(direct)'

/** A pageview after edge enrichment. Raw IP, user agent and full URL are already gone. */
export interface PageEvent {
  /** Project site key. */
  k: string
  /** Epoch milliseconds. */
  t: number
  /** Daily-salted visitor id, 16 hex chars. */
  v: string
  /** Path, query string stripped. */
  p: string
  /** Referrer domain, or '' for none and same-site. */
  r: string
  /** ISO country code, or ''. */
  c: string
  d: string
  b: string
  o: string
  /** utm_source, or ''. */
  u: string
}

/** What the tracker sends. */
export interface TrackerPayload {
  s: string
  u: string
  r?: string
  w?: number
}

export interface Counters {
  pageviews: number
  visitors: number
  visits: number
  bounces: number
}

/** One project's additive delta for one hour. */
export interface ProjectHourDelta extends Counters {
  siteKey: string
  /** Visitors first seen today during this hour. Sums to the day's visitors. */
  dayVisitors: number
  breakdown: Breakdown
}

/** The idempotent unit of a flush: everything one shard holds for one hour. */
export interface FlushUnit {
  flushId: string
  /** ISO timestamp of the hour start (UTC). */
  hour: string
  projects: ProjectHourDelta[]
}

export interface TodaySnapshot extends Counters {
  dayVisitors: number
  breakdown: Breakdown
  /** Unflushed counters keyed by ISO hour start. */
  hours: Record<string, Counters>
}

/** What the all-projects overview needs for one project, without the breakdowns. */
export interface LiveSummary {
  live: number
  /** Pageviews not yet flushed. */
  pageviews: number
  /** Today's visitors not yet flushed. */
  dayVisitors: number
}

export interface ProjectConfig {
  siteKey: string
  domains: string[]
  dailyCap: number
}
