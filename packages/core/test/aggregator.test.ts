import { describe, expect, it } from 'vitest'
import { Aggregator, DIRECT, HOUR_MS, OTHER, type PageEvent, SESSION_MS } from '../src'

const T0 = Date.UTC(2026, 9, 4, 10, 0, 0)
const ev = (over: Partial<PageEvent> = {}): PageEvent => ({
  k: 'site000001',
  t: T0,
  v: 'aaaa',
  p: '/',
  r: '',
  c: 'US',
  d: 'desktop',
  b: 'Chrome',
  o: 'macOS',
  u: '',
  ...over,
})

describe('Aggregator', () => {
  it('counts pageviews, hourly and daily visitors, visits and bounces', () => {
    const a = new Aggregator()
    a.add(ev({ v: 'a' }))
    a.add(ev({ v: 'a', t: T0 + 60_000, p: '/pricing' }))
    a.add(ev({ v: 'b', t: T0 + 120_000 }))
    a.add(ev({ v: 'a', t: T0 + HOUR_MS + 1 }))
    const [first, second] = a.units()
    expect(first?.hour).toBe(T0)
    expect(first?.projects[0]).toMatchObject({
      siteKey: 'site000001',
      pageviews: 3,
      visitors: 2,
      dayVisitors: 2,
      visits: 2,
      bounces: 1,
    })
    // Visitor a returns in the next hour, after the session window: a new visit, not a new daily visitor.
    expect(second?.projects[0]).toMatchObject({
      pageviews: 1,
      visitors: 1,
      dayVisitors: 0,
      visits: 1,
      bounces: 1,
    })
  })

  it('keeps a session open across an hour boundary and un-counts its bounce there', () => {
    const a = new Aggregator()
    a.add(ev({ t: T0 + HOUR_MS - 60_000 }))
    a.add(ev({ t: T0 + HOUR_MS + 60_000, p: '/b' }))
    const [first, second] = a.units()
    expect(first?.projects[0]).toMatchObject({ visits: 1, bounces: 1 })
    expect(second?.projects[0]).toMatchObject({ visits: 0, bounces: -1 })
  })

  it('starts a new visit after 30 idle minutes', () => {
    const a = new Aggregator()
    a.add(ev())
    a.add(ev({ t: T0 + SESSION_MS + 1 }))
    expect(a.today('site000001')).toMatchObject({ visits: 2, bounces: 2, dayVisitors: 1 })
  })

  it('credits the visit source to every pageview of the visit', () => {
    const a = new Aggregator()
    a.add(ev({ r: 'news.ycombinator.com', u: 'hn' }))
    a.add(ev({ t: T0 + 1000, p: '/pricing' }))
    a.add(ev({ v: 'b', t: T0 + 2000 }))
    const { breakdown } = a.today('site000001')
    expect(breakdown.referrer).toEqual({ 'news.ycombinator.com': [2, 1], [DIRECT]: [1, 1] })
    expect(breakdown.utm_source).toEqual({ hn: [2, 1] })
    expect(breakdown.page).toEqual({ '/': [2, 2], '/pricing': [1, 1] })
    expect(breakdown.country).toEqual({ US: [3, 2] })
  })

  it('drops pageviews past the daily cap and resets the cap at UTC midnight', () => {
    const a = new Aggregator()
    expect(a.add(ev(), 2)).toBe(true)
    expect(a.add(ev({ t: T0 + 1 }), 2)).toBe(true)
    expect(a.add(ev({ t: T0 + 2 }), 2)).toBe(false)
    expect(a.add(ev({ t: T0 + 24 * HOUR_MS }), 2)).toBe(true)
    expect(a.today('site000001').pageviews).toBe(3)
  })

  it('counts a returning visitor again after the UTC day rolls over', () => {
    const a = new Aggregator()
    a.add(ev({ t: Date.UTC(2026, 9, 4, 23, 30) }))
    a.add(ev({ t: Date.UTC(2026, 9, 5, 0, 30) }))
    expect(a.units().map((u) => u.projects[0]?.dayVisitors)).toEqual([1, 1])
  })

  it('returns only hours before the cutoff and forgets hours once removed', () => {
    const a = new Aggregator()
    a.add(ev())
    a.add(ev({ t: T0 + HOUR_MS }))
    const ready = a.units(T0 + HOUR_MS)
    expect(ready.map((u) => u.hour)).toEqual([T0])
    a.remove([T0])
    expect(a.units().map((u) => u.hour)).toEqual([T0 + HOUR_MS])
    expect(a.today('site000001').pageviews).toBe(1)
  })

  it('reports live visitors from the last five minutes', () => {
    const a = new Aggregator()
    a.add(ev({ v: 'a' }))
    a.add(ev({ v: 'b', t: T0 + 4 * 60_000 }))
    expect(a.live('site000001', T0 + 4 * 60_000)).toBe(2)
    expect(a.live('site000001', T0 + 6 * 60_000)).toBe(1)
    expect(a.live('unknown000', T0)).toBe(0)
  })

  it('rebuilds identical state when the same events are replayed', () => {
    const events = Array.from({ length: 500 }, (_, i) =>
      ev({ v: `v${i % 37}`, t: T0 + i * 20_000, p: `/p${i % 11}`, k: `site00000${i % 3}` }),
    )
    const a = new Aggregator()
    const b = new Aggregator()
    for (const e of events) a.add(e)
    for (const e of events) b.add(e)
    expect(b.units()).toEqual(a.units())
  })

  it('folds values past the top 50 into (other)', () => {
    const a = new Aggregator()
    for (let i = 0; i < 60; i++) a.add(ev({ v: `v${i}`, t: T0 + i, p: `/page-${i}` }))
    const pages = a.units()[0]?.projects[0]?.breakdown.page ?? {}
    expect(Object.keys(pages)).toHaveLength(51)
    expect(pages[OTHER]).toEqual([10, 10])
  })
})
