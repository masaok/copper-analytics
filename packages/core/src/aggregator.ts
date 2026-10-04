import { HOUR_MS, hourStart, utcDayIndex } from './time'
import { DAILY_TOP_N, truncateBreakdown } from './topn'
import {
  type Breakdown,
  type Counters,
  DIMENSIONS,
  DIRECT,
  OTHER,
  type PageEvent,
  type ProjectHourDelta,
  type Tally,
  type TodaySnapshot,
} from './types'

export const SESSION_MS = 30 * 60_000
export const LIVE_WINDOW_MS = 5 * 60_000
/** Distinct values kept per dimension per hour before the rest fold into `(other)`. Bounds memory. */
export const MAX_KEYS_PER_DIMENSION = 2000

interface HourAgg extends Counters {
  dayVisitors: number
  dims: Map<string, Tally>[]
}

interface Session {
  last: number
  pageviews: number
  referrer: string
  utm: string
}

interface ProjectState {
  day: number
  dayPageviews: number
  /** Keys seen today: `v|visitor` and `dimIndex|value|visitor`. Cleared at UTC midnight with the salt. */
  seenToday: Set<string>
  hourVisitors: Map<number, Set<string>>
  sessions: Map<string, Session>
  hours: Map<number, HourAgg>
}

export interface HourUnit {
  hour: number
  projects: ProjectHourDelta[]
}

const emptyHour = (): HourAgg => ({
  pageviews: 0,
  visitors: 0,
  dayVisitors: 0,
  visits: 0,
  bounces: 0,
  dims: DIMENSIONS.map(() => new Map()),
})

function breakdownOf(agg: HourAgg): Breakdown {
  const out: Breakdown = {}
  DIMENSIONS.forEach((dim, i) => {
    const map = agg.dims[i] as Map<string, Tally>
    if (map.size > 0) out[dim] = Object.fromEntries([...map].map(([k, t]) => [k, [t[0], t[1]]]))
  })
  return out
}

/**
 * Turns a stream of pageviews into additive hourly deltas per project.
 *
 * It is deterministic over its input, so a shard that restarts can rebuild the
 * same state by replaying the events it persisted.
 */
export class Aggregator {
  private readonly projects = new Map<string, ProjectState>()

  /** Counts one pageview. Returns false when the project's daily cap drops it. */
  add(event: PageEvent, dailyCap = 0): boolean {
    let state = this.projects.get(event.k)
    const day = utcDayIndex(event.t)
    if (!state) {
      state = {
        day,
        dayPageviews: 0,
        seenToday: new Set(),
        hourVisitors: new Map(),
        sessions: new Map(),
        hours: new Map(),
      }
      this.projects.set(event.k, state)
    } else if (day > state.day) {
      state.day = day
      state.dayPageviews = 0
      state.seenToday.clear()
    }
    if (dailyCap > 0 && state.dayPageviews >= dailyCap) return false
    state.dayPageviews++

    const hour = hourStart(event.t)
    let agg = state.hours.get(hour)
    if (!agg) {
      agg = emptyHour()
      state.hours.set(hour, agg)
    }
    agg.pageviews++

    let inHour = state.hourVisitors.get(hour)
    if (!inHour) {
      inHour = new Set()
      state.hourVisitors.set(hour, inHour)
    }
    if (!inHour.has(event.v)) {
      inHour.add(event.v)
      agg.visitors++
    }
    const visitorKey = `v|${event.v}`
    if (!state.seenToday.has(visitorKey)) {
      state.seenToday.add(visitorKey)
      agg.dayVisitors++
    }

    let session = state.sessions.get(event.v)
    if (!session || event.t - session.last > SESSION_MS) {
      session = { last: event.t, pageviews: 1, referrer: event.r || DIRECT, utm: event.u }
      state.sessions.set(event.v, session)
      agg.visits++
      agg.bounces++
    } else {
      session.pageviews++
      session.last = event.t
      // A second pageview means the visit was not a bounce after all.
      if (session.pageviews === 2) agg.bounces--
    }

    // A visit's source applies to all of its pageviews, so internal navigation keeps its referrer.
    const values = [event.p, session.referrer, event.c, event.d, event.b, event.o, session.utm]
    for (let i = 0; i < values.length; i++) {
      let value = values[i]
      if (!value) continue
      const map = agg.dims[i] as Map<string, Tally>
      let tally = map.get(value)
      if (!tally) {
        if (map.size >= MAX_KEYS_PER_DIMENSION) {
          value = OTHER
          tally = map.get(OTHER)
        }
        if (!tally) {
          tally = [0, 0]
          map.set(value, tally)
        }
      }
      tally[0]++
      const seenKey = `${i}|${value}|${event.v}`
      if (!state.seenToday.has(seenKey)) {
        state.seenToday.add(seenKey)
        tally[1]++
      }
    }
    return true
  }

  /** Deltas for every buffered hour that starts before `beforeMs`, oldest first. Nothing is removed. */
  units(beforeMs = Number.POSITIVE_INFINITY): HourUnit[] {
    const byHour = new Map<number, ProjectHourDelta[]>()
    for (const [siteKey, state] of this.projects) {
      for (const [hour, agg] of state.hours) {
        if (hour >= beforeMs) continue
        const list = byHour.get(hour) ?? []
        byHour.set(hour, list)
        list.push({
          siteKey,
          pageviews: agg.pageviews,
          visitors: agg.visitors,
          dayVisitors: agg.dayVisitors,
          visits: agg.visits,
          bounces: agg.bounces,
          breakdown: truncateBreakdown(breakdownOf(agg), DAILY_TOP_N),
        })
      }
    }
    return [...byHour].sort((a, b) => a[0] - b[0]).map(([hour, projects]) => ({ hour, projects }))
  }

  /** Drops the counters for these hours once they are safely stored elsewhere. */
  remove(hours: Iterable<number>): void {
    for (const hour of hours) for (const state of this.projects.values()) state.hours.delete(hour)
  }

  /** Forgets expired sessions, past hours' visitor sets and projects idle since before today. */
  prune(now: number): void {
    const today = utcDayIndex(now)
    const currentHour = hourStart(now)
    for (const [siteKey, state] of this.projects) {
      for (const [id, session] of state.sessions) {
        if (now - session.last > SESSION_MS) state.sessions.delete(id)
      }
      for (const hour of state.hourVisitors.keys()) {
        if (hour < currentHour && !state.hours.has(hour)) state.hourVisitors.delete(hour)
      }
      if (state.day < today && state.hours.size === 0 && state.sessions.size === 0) {
        this.projects.delete(siteKey)
      }
    }
  }

  /** Visitors with a pageview in the last five minutes. */
  live(siteKey: string, now: number): number {
    let count = 0
    for (const session of this.projects.get(siteKey)?.sessions.values() ?? []) {
      if (now - session.last <= LIVE_WINDOW_MS) count++
    }
    return count
  }

  /** Everything buffered for a project that has not been removed yet. */
  today(siteKey: string): TodaySnapshot {
    const snapshot: TodaySnapshot = {
      pageviews: 0,
      visitors: 0,
      dayVisitors: 0,
      visits: 0,
      bounces: 0,
      breakdown: {},
      hours: {},
    }
    const state = this.projects.get(siteKey)
    if (!state) return snapshot
    const merged = emptyHour()
    for (const [hour, agg] of state.hours) {
      snapshot.pageviews += agg.pageviews
      snapshot.visitors += agg.visitors
      snapshot.dayVisitors += agg.dayVisitors
      snapshot.visits += agg.visits
      snapshot.bounces += agg.bounces
      snapshot.hours[new Date(hour).toISOString()] = {
        pageviews: agg.pageviews,
        visitors: agg.visitors,
        visits: agg.visits,
        bounces: agg.bounces,
      }
      agg.dims.forEach((map, i) => {
        const into = merged.dims[i] as Map<string, Tally>
        for (const [key, tally] of map) {
          const cur = into.get(key)
          if (cur) {
            cur[0] += tally[0]
            cur[1] += tally[1]
          } else {
            into.set(key, [tally[0], tally[1]])
          }
        }
      })
    }
    snapshot.breakdown = truncateBreakdown(breakdownOf(merged), DAILY_TOP_N)
    return snapshot
  }

  get projectCount(): number {
    return this.projects.size
  }
}

export const topOfHour = (now: number): number => Math.floor(now / HOUR_MS) * HOUR_MS
