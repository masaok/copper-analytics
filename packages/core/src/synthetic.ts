import { Aggregator } from './aggregator'
import { DAY_MS, HOUR_MS } from './time'
import type { FlushUnit, PageEvent } from './types'

/** Small seeded PRNG (mulberry32), so generated traffic is the same on every run. */
export function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const REFERRERS = [
  '',
  '',
  '',
  'google.com',
  'google.com',
  'news.ycombinator.com',
  'github.com',
  't.co',
  'reddit.com',
  'bing.com',
  'duckduckgo.com',
]
const COUNTRIES = ['US', 'US', 'US', 'DE', 'GB', 'IN', 'CA', 'FR', 'JP', 'BR', 'NL', 'AU']
const DEVICES: [string, string, string][] = [
  ['desktop', 'Chrome', 'macOS'],
  ['desktop', 'Chrome', 'Windows'],
  ['desktop', 'Firefox', 'Linux'],
  ['desktop', 'Safari', 'macOS'],
  ['mobile', 'Safari', 'iOS'],
  ['mobile', 'Chrome', 'Android'],
  ['tablet', 'Safari', 'iOS'],
]
const UTM = ['', '', '', '', 'newsletter', 'hn', 'twitter']
/** Share of a day's visits that start in each UTC hour. Low overnight, peaking mid-afternoon. */
const HOURLY_SHAPE = [1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 7, 8, 8, 8, 7, 7, 6, 5, 4, 3, 2, 2, 1]
const SHAPE_TOTAL = HOURLY_SHAPE.reduce((a, b) => a + b, 0)

const pick = <T>(rand: () => number, items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)] as T

export interface SyntheticOptions {
  siteKey: string
  /** Inclusive start, epoch ms. Rounded down to the UTC day. */
  from: number
  /** Exclusive end, epoch ms. */
  to: number
  visitsPerDay: number
  /** Distinct pages on the site. */
  pages?: number
  seed?: number
}

/** Plausible pageviews for one site, in time order within each day. */
export function* syntheticEvents(options: SyntheticOptions): Generator<PageEvent> {
  const { siteKey, from, to, visitsPerDay, pages = 12, seed = 1 } = options
  const rand = prng(seed)
  const paths = ['/', '/pricing', '/docs', '/blog', '/about', '/changelog'].concat(
    Array.from({ length: Math.max(0, pages - 6) }, (_, i) => `/blog/post-${i + 1}`),
  )
  const pool = Math.max(1, Math.round(visitsPerDay * 0.8))
  for (let day = Math.floor(from / DAY_MS) * DAY_MS; day < to; day += DAY_MS) {
    const events: PageEvent[] = []
    const weekend = [0, 6].includes(new Date(day).getUTCDay()) ? 0.6 : 1
    const visits = Math.round(visitsPerDay * weekend * (0.8 + rand() * 0.4))
    for (let i = 0; i < visits; i++) {
      let roll = rand() * SHAPE_TOTAL
      let hour = 0
      while (roll > (HOURLY_SHAPE[hour] as number)) roll -= HOURLY_SHAPE[hour++] as number
      let t = day + hour * HOUR_MS + Math.floor(rand() * HOUR_MS)
      const [d, b, o] = pick(rand, DEVICES)
      const base = {
        k: siteKey,
        v: `${(day / DAY_MS).toString(36)}-${Math.floor(rand() * pool).toString(36)}`,
        r: pick(rand, REFERRERS),
        c: pick(rand, COUNTRIES),
        d,
        b,
        o,
        u: pick(rand, UTM),
      }
      const depth = rand() < 0.45 ? 1 : 2 + Math.floor(rand() * 3)
      for (let n = 0; n < depth; n++) {
        // Squaring the roll favors the first few paths, like a real site's home and pricing pages.
        const p = paths[Math.floor(rand() ** 2 * paths.length)] as string
        if (t >= from && t < to) events.push({ ...base, t, p })
        t += 15_000 + Math.floor(rand() * 120_000)
      }
    }
    events.sort((a, b) => a.t - b.t)
    yield* events
  }
}

/** Runs events through the aggregator and returns one flush unit per hour, as a shard would. */
export function unitsFrom(events: Iterable<PageEvent>): FlushUnit[] {
  const aggregator = new Aggregator()
  for (const event of events) aggregator.add(event)
  return aggregator.units().map((u) => {
    const hour = new Date(u.hour).toISOString()
    return { flushId: hour, hour, projects: u.projects }
  })
}
