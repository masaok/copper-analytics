import { describe, expect, it } from 'vitest'
import {
  bounceRate,
  bucketsOf,
  isRangeId,
  localMidnight,
  percentChange,
  resolveRange,
} from '../src'

const NOW = Date.UTC(2026, 9, 4, 20, 30) // 13:30 in Los Angeles, 22:30 in Berlin

describe('resolveRange', () => {
  it('starts Today at local midnight and compares with the same hours yesterday', () => {
    const r = resolveRange('today', NOW, 'America/Los_Angeles')
    expect(r.grain).toBe('hour')
    expect(r.current).toEqual({ from: '2026-10-04T07:00:00.000Z', to: '2026-10-04T20:00:00.000Z' })
    expect(r.previous).toEqual({ from: '2026-10-03T17:00:00.000Z', to: '2026-10-04T06:00:00.000Z' })
    expect(r.days).toEqual({ from: '2026-10-04', to: '2026-10-04' })
    expect(bucketsOf(r.grain, r.current)).toHaveLength(14)
  })

  it('finds local midnight across timezones', () => {
    expect(new Date(localMidnight(NOW, 'UTC')).toISOString()).toBe('2026-10-04T00:00:00.000Z')
    expect(new Date(localMidnight(NOW, 'Europe/Berlin')).toISOString()).toBe(
      '2026-10-03T22:00:00.000Z',
    )
    expect(new Date(localMidnight(NOW, 'Asia/Tokyo')).toISOString()).toBe(
      '2026-10-04T15:00:00.000Z',
    )
  })

  it('covers 24 hourly buckets for 24h', () => {
    const r = resolveRange('24h', NOW, 'UTC')
    expect(bucketsOf(r.grain, r.current)).toHaveLength(24)
    expect(r.current.to).toBe('2026-10-04T20:00:00.000Z')
    expect(r.previous.to).toBe('2026-10-03T20:00:00.000Z')
  })

  it('uses daily buckets for 7d and 30d with the preceding period as baseline', () => {
    const week = resolveRange('7d', NOW, 'UTC')
    expect(week.current).toEqual({ from: '2026-09-28', to: '2026-10-04' })
    expect(week.previous).toEqual({ from: '2026-09-21', to: '2026-09-27' })
    expect(week.breakdownSource).toBe('daily')
    expect(bucketsOf('day', resolveRange('30d', NOW, 'UTC').current)).toHaveLength(30)
  })

  it('uses monthly buckets and monthly breakdowns for 12 months', () => {
    const r = resolveRange('12mo', NOW, 'UTC')
    expect(r.current).toEqual({ from: '2025-11-01', to: '2026-10-04' })
    expect(r.previous).toEqual({ from: '2024-11-01', to: '2025-10-31' })
    expect(r.breakdownSource).toBe('monthly')
    expect(bucketsOf(r.grain, r.current)).toHaveLength(12)
  })

  it('clamps a custom range and switches to monthly breakdowns past 90 days', () => {
    const short = resolveRange('custom', NOW, 'UTC', { from: '2026-09-01', to: '2026-09-10' })
    expect(short).toMatchObject({
      current: { from: '2026-09-01', to: '2026-09-10' },
      previous: { from: '2026-08-22', to: '2026-08-31' },
      breakdownSource: 'daily',
      includesNow: false,
    })
    expect(
      resolveRange('custom', NOW, 'UTC', { from: '2026-05-01', to: '2026-10-04' }).breakdownSource,
    ).toBe('monthly')
    expect(
      resolveRange('custom', NOW, 'UTC', { from: '2020-01-01', to: '2099-01-01' }).current,
    ).toEqual({
      from: '2025-10-04',
      to: '2026-10-04',
    })
    expect(resolveRange('custom', NOW, 'UTC', { from: 'junk', to: 'junk' }).current).toEqual({
      from: '2026-09-05',
      to: '2026-10-04',
    })
  })
})

describe('helpers', () => {
  it('computes percent change and bounce rate', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
    expect(percentChange(5, 0)).toBeNull()
    expect(bounceRate(45, 100)).toBe(45)
    expect(bounceRate(-3, 10)).toBe(0)
    expect(bounceRate(12, 10)).toBe(100)
    expect(bounceRate(1, 0)).toBe(0)
  })

  it('recognizes range ids', () => {
    expect(isRangeId('7d')).toBe(true)
    expect(isRangeId('forever')).toBe(false)
  })
})
