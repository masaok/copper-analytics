import type { Grain } from '@copper/core'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en')

/** 1,234 below ten thousand, 12.3K above. */
export const formatNumber = (n: number): string =>
  Math.abs(n) < 10_000 ? plain.format(n) : compact.format(n)

/** A bucket as an axis tick: `14:00`, `Oct 4` or `Oct 2026`. */
export function formatBucket(grain: Grain, bucket: string, timeZone: string, long = false): string {
  if (grain === 'hour') {
    return new Intl.DateTimeFormat('en', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      ...(long ? { month: 'short', day: 'numeric' } : {}),
    }).format(new Date(bucket))
  }
  const date = new Date(`${bucket}T00:00:00Z`)
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    month: 'short',
    ...(grain === 'month' ? { year: 'numeric' } : { day: 'numeric' }),
    ...(long && grain === 'day' ? { weekday: 'short' } : {}),
  }).format(date)
}
