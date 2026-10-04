export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000

export const hourStart = (ms: number): number => Math.floor(ms / HOUR_MS) * HOUR_MS
export const utcDayIndex = (ms: number): number => Math.floor(ms / DAY_MS)

const formatters = new Map<string, Intl.DateTimeFormat>()

/** Calendar date (`YYYY-MM-DD`) of an instant in an IANA timezone. Unknown zones fall back to UTC. */
export function localDay(ms: number, timeZone: string): string {
  let fmt = formatters.get(timeZone)
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    } catch {
      fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    }
    formatters.set(timeZone, fmt)
  }
  return fmt.format(ms)
}

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return true
  } catch {
    return false
  }
}

/** `YYYY-MM-DD` shifted by whole days. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** First day of the month containing `day`. */
export const monthOf = (day: string): string => `${day.slice(0, 7)}-01`

export function addMonths(month: string, n: number): string {
  const d = new Date(`${month}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}
