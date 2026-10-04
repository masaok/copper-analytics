import { addDays, addMonths, DAY_MS, HOUR_MS, hourStart, localDay, monthOf } from './time'

/** The range picker's options. The picker, the URL parameter and the queries all read this list. */
export const RANGES = [
  { id: 'today', label: 'Today' },
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '12mo', label: '12 months' },
  { id: 'custom', label: 'Custom' },
] as const
export type RangeId = (typeof RANGES)[number]['id']
export const isRangeId = (value: unknown): value is RangeId => RANGES.some((r) => r.id === value)

/** Breakdowns come from daily documents up to this many days, monthly ones beyond it. */
export const DAILY_BREAKDOWN_MAX_DAYS = 90
export const MAX_CUSTOM_DAYS = 366

export type Grain = 'hour' | 'day' | 'month'

export interface Span {
  /** Inclusive. An ISO instant for hour grain, `YYYY-MM-DD` otherwise. */
  from: string
  /** Inclusive, same form as `from`. */
  to: string
}

export interface ResolvedRange {
  id: RangeId
  grain: Grain
  current: Span
  /** The period of equal length just before, for the percent change. */
  previous: Span
  /** Local days the range touches, for breakdown lookups. */
  days: Span
  breakdownSource: 'daily' | 'monthly'
  /** Whether the range reaches the present, so unflushed counters belong in it. */
  includesNow: boolean
}

const iso = (ms: number) => new Date(ms).toISOString()
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1

/** First hour of `now`'s calendar day in the given timezone. */
export function localMidnight(now: number, timeZone: string): number {
  const today = localDay(now, timeZone)
  let hour = hourStart(now)
  // A day is at most 25 hours long, daylight saving included.
  for (let i = 0; i < 25 && localDay(hour - HOUR_MS, timeZone) === today; i++) hour -= HOUR_MS
  return hour
}

export function resolveRange(
  id: RangeId,
  now: number,
  timeZone: string,
  custom?: { from?: string; to?: string },
): ResolvedRange {
  const today = localDay(now, timeZone)
  const thisHour = hourStart(now)

  if (id === 'today' || id === '24h') {
    const from = id === 'today' ? localMidnight(now, timeZone) : thisHour - 23 * HOUR_MS
    const length = thisHour - from + HOUR_MS
    return {
      id,
      grain: 'hour',
      current: { from: iso(from), to: iso(thisHour) },
      previous: { from: iso(from - length), to: iso(thisHour - length) },
      days: { from: localDay(from, timeZone), to: today },
      breakdownSource: 'daily',
      includesNow: true,
    }
  }

  if (id === '12mo') {
    const from = addMonths(monthOf(today), -11)
    return {
      id,
      grain: 'month',
      current: { from, to: today },
      previous: { from: addMonths(from, -12), to: addDays(from, -1) },
      days: { from, to: today },
      breakdownSource: 'monthly',
      includesNow: true,
    }
  }

  let from = addDays(today, id === '7d' ? -6 : -29)
  let to = today
  if (id === 'custom') {
    const valid = (d?: string): d is string =>
      !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d))
    to = valid(custom?.to) && custom.to <= today ? custom.to : today
    from = valid(custom?.from) && custom.from <= to ? custom.from : addDays(to, -29)
    if (daysBetween(from, to) > MAX_CUSTOM_DAYS) from = addDays(to, -(MAX_CUSTOM_DAYS - 1))
  }
  const length = daysBetween(from, to)
  return {
    id,
    grain: 'day',
    current: { from, to },
    previous: { from: addDays(from, -length), to: addDays(from, -1) },
    days: { from, to },
    breakdownSource: length > DAILY_BREAKDOWN_MAX_DAYS ? 'monthly' : 'daily',
    includesNow: to === today,
  }
}

/** Every bucket label in a span, so a chart shows zeros for quiet periods instead of gaps. */
export function bucketsOf(grain: Grain, span: Span): string[] {
  const out: string[] = []
  if (grain === 'hour') {
    for (let t = Date.parse(span.from); t <= Date.parse(span.to); t += HOUR_MS) out.push(iso(t))
  } else if (grain === 'day') {
    for (let d = span.from; d <= span.to; d = addDays(d, 1)) out.push(d)
  } else {
    for (let m = monthOf(span.from); m <= span.to; m = addMonths(m, 1)) out.push(m)
  }
  return out
}

/** Percent change from `previous` to `current`, or null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

/** Bounce rate as a whole percent, clamped because hourly bounce deltas can dip below zero. */
export function bounceRate(bounces: number, visits: number): number {
  if (visits <= 0) return 0
  return Math.round((Math.min(Math.max(bounces, 0), visits) / visits) * 100)
}
