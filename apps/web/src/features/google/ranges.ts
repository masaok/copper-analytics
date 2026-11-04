/** Pure helpers shared by the Google pages: the date ranges, and hosts compared without `www.`. */

export const GOOGLE_RANGES = { '7d': 7, '28d': 28, '3m': 90 } as const
export type GoogleRangeId = keyof typeof GOOGLE_RANGES

export const isGoogleRangeId = (value: unknown): value is GoogleRangeId =>
  typeof value === 'string' && Object.hasOwn(GOOGLE_RANGES, value)

/** A host in lower case without a leading `www.`, so `www.Example.com` and `example.com` compare equal. */
export const bare = (host: string) => host.toLowerCase().replace(/^www\./, '')

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** The last `days` whole days, ending yesterday (UTC), as YYYY-MM-DD dates. */
export function searchWindow(days: number, now = Date.now()): { from: string; to: string } {
  const day = 86_400_000
  const yesterday = now - day
  return { from: isoDay(yesterday - (days - 1) * day), to: isoDay(yesterday) }
}

/** Every day from `from` to `to`, inclusive, so days with no traffic still plot as zero. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) out.push(isoDay(t))
  return out
}
