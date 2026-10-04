import { type Breakdown, DIMENSIONS, OTHER, type Tally } from './types'

export const DAILY_TOP_N = 50
export const MONTHLY_TOP_N = 100

/** Adds `from` into `into`, returning `into`. */
export function mergeBreakdown(into: Breakdown, from: Breakdown): Breakdown {
  for (const dim of DIMENSIONS) {
    const src = from[dim]
    if (!src) continue
    const dst = into[dim] ?? {}
    into[dim] = dst
    for (const [key, [pv, vis]] of Object.entries(src)) {
      const cur = dst[key]
      if (cur) {
        cur[0] += pv
        cur[1] += vis
      } else {
        dst[key] = [pv, vis]
      }
    }
  }
  return into
}

/** Keeps the `n` largest entries per dimension by pageviews and folds the rest into `(other)`. */
export function truncateBreakdown(breakdown: Breakdown, n: number): Breakdown {
  const out: Breakdown = {}
  for (const dim of DIMENSIONS) {
    const src = breakdown[dim]
    if (!src) continue
    const other: Tally = [0, 0]
    const entries: [string, Tally][] = []
    for (const [key, tally] of Object.entries(src)) {
      if (key === OTHER) {
        other[0] += tally[0]
        other[1] += tally[1]
      } else {
        entries.push([key, tally])
      }
    }
    entries.sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1] || a[0].localeCompare(b[0]))
    for (const [, tally] of entries.slice(n)) {
      other[0] += tally[0]
      other[1] += tally[1]
    }
    const kept: Record<string, Tally> = Object.fromEntries(entries.slice(0, n))
    if (other[0] > 0 || other[1] > 0) kept[OTHER] = other
    out[dim] = kept
  }
  return out
}

/** Rows for a panel: largest first, `(other)` last. */
export function topEntries(
  breakdown: Breakdown,
  dim: (typeof DIMENSIONS)[number],
  limit = 10,
): { key: string; pageviews: number; visitors: number }[] {
  const rows = Object.entries(breakdown[dim] ?? {}).map(([key, [pageviews, visitors]]) => ({
    key,
    pageviews,
    visitors,
  }))
  rows.sort(
    (a, b) =>
      Number(a.key === OTHER) - Number(b.key === OTHER) ||
      b.pageviews - a.pageviews ||
      a.key.localeCompare(b.key),
  )
  return rows.slice(0, limit)
}
