import { type Hit, HOUR_MS } from '@copper/core'
import { describe, expect, it } from 'vitest'
import { BATCH_SIZE, MemoryShardStorage, ShardCore } from '../src/shard-core'

const T0 = Date.UTC(2026, 9, 4, 10, 0, 0)
const hit = (over: Partial<Hit> = {}): Hit => ({
  k: 'site000001',
  t: T0,
  p: '/',
  r: '',
  c: 'US',
  d: 'desktop',
  b: 'Chrome',
  o: 'macOS',
  u: '',
  ip: '203.0.113.1',
  ua: 'Mozilla/5.0 Chrome/140',
  ...over,
})

describe('ShardCore', () => {
  it('writes a micro-batch at 100 events and keeps the tail until persist', async () => {
    const storage = new MemoryShardStorage()
    const core = new ShardCore(storage)
    for (let i = 0; i < BATCH_SIZE + 5; i++) await core.add(hit({ t: T0 + i }), 0)
    expect(storage.rows).toHaveLength(1)
    expect(storage.rows[0]?.events).toHaveLength(BATCH_SIZE)
    expect(core.hasUnsaved).toBe(true)
    core.persist()
    expect(storage.rows).toHaveLength(2)
    expect(core.hasUnsaved).toBe(false)
  })

  it('stores neither the IP address nor the user agent', async () => {
    const storage = new MemoryShardStorage()
    const core = new ShardCore(storage)
    await core.add(hit(), 0)
    core.persist()
    const stored = JSON.stringify([storage.rows, [...storage.meta]])
    expect(stored).not.toContain('203.0.113.1')
    expect(stored).not.toContain('Mozilla')
    expect(storage.rows[0]?.events[0]?.v).toMatch(/^[0-9a-f]{16}$/)
  })

  it('rebuilds the same pending units after a restart', async () => {
    const storage = new MemoryShardStorage()
    const core = new ShardCore(storage)
    for (let i = 0; i < 250; i++) {
      await core.add(hit({ t: T0 + i * 30_000, ip: `203.0.113.${i % 9}`, p: `/p${i % 4}` }), 0)
    }
    const later = T0 + 3 * HOUR_MS
    const before = await core.pending(later)
    expect(before.length).toBeGreaterThan(1)

    const restarted = new ShardCore(storage)
    expect(await restarted.pending(later)).toEqual(before)
  })

  it('loses only the unsaved tail when it crashes between batches', async () => {
    const storage = new MemoryShardStorage()
    const core = new ShardCore(storage)
    for (let i = 0; i < BATCH_SIZE + 7; i++)
      await core.add(hit({ t: T0 + i, ip: `198.51.100.${i}` }), 0)
    const restarted = new ShardCore(storage)
    expect((await restarted.today('site000001')).pageviews).toBe(BATCH_SIZE)
  })

  it('offers only finished hours, with the hour as the flush id', async () => {
    const core = new ShardCore(new MemoryShardStorage())
    await core.add(hit(), 0)
    await core.add(hit({ t: T0 + HOUR_MS + 1 }), 0)
    const units = await core.pending(T0 + HOUR_MS + 5 * 60_000)
    expect(units.map((u) => u.flushId)).toEqual(['2026-10-04T10:00:00.000Z'])
    expect(units[0]?.projects[0]).toMatchObject({ siteKey: 'site000001', pageviews: 1 })
  })

  it('keeps an hour pending, under the same id, until it is acked', async () => {
    const storage = new MemoryShardStorage()
    const core = new ShardCore(storage, () => T0 + 2 * HOUR_MS)
    await core.add(hit(), 0)
    const first = await core.pending(T0 + HOUR_MS)
    const retry = await core.pending(T0 + 2 * HOUR_MS)
    expect(retry).toEqual(first)

    await core.ack(first.map((u) => u.flushId))
    expect(await core.pending(T0 + 2 * HOUR_MS)).toEqual([])
    // A restart after the ack must not resurrect the flushed hour.
    expect(await new ShardCore(storage, () => T0 + 2 * HOUR_MS).pending(T0 + 2 * HOUR_MS)).toEqual(
      [],
    )
  })

  it('remembers who visited today across a flush and a restart', async () => {
    const storage = new MemoryShardStorage()
    const clock = () => T0 + HOUR_MS + 60_000
    const core = new ShardCore(storage, clock)
    await core.add(hit(), 0)
    await core.ack((await core.pending(clock())).map((u) => u.flushId))

    const restarted = new ShardCore(storage, clock)
    await restarted.add(hit({ t: T0 + HOUR_MS + 31 * 60_000 }), 0)
    const [unit] = await restarted.pending(T0 + 3 * HOUR_MS)
    expect(unit?.projects[0]).toMatchObject({
      pageviews: 1,
      visitors: 1,
      dayVisitors: 0,
      visits: 1,
    })
  })

  it('drops old batches once their day is over and flushed', async () => {
    const storage = new MemoryShardStorage()
    let now = T0
    const core = new ShardCore(storage, () => now)
    await core.add(hit(), 0)
    core.persist()
    now = T0 + 24 * HOUR_MS
    await core.add(hit({ t: now }), 0)
    await core.ack((await core.pending(now)).map((u) => u.flushId))
    expect(storage.rows.map((r) => r.ts)).toEqual([now])
  })

  it('changes the salt at UTC midnight, so the same browser gets a new id', async () => {
    const storage = new MemoryShardStorage()
    const core = new ShardCore(storage)
    await core.add(hit({ t: Date.UTC(2026, 9, 4, 23, 59) }), 0)
    const firstSalt = storage.meta.get('salt')
    await core.add(hit({ t: Date.UTC(2026, 9, 5, 0, 1) }), 0)
    core.persist()
    expect(storage.meta.get('salt')).not.toBe(firstSalt)
    const [a, b] = storage.rows[0]?.events ?? []
    expect(a?.v).not.toBe(b?.v)
  })

  it('counts a late event in the oldest open hour instead of a flushed one', async () => {
    const core = new ShardCore(new MemoryShardStorage(), () => T0 + HOUR_MS)
    await core.add(hit(), 0)
    await core.ack((await core.pending(T0 + HOUR_MS)).map((u) => u.flushId))
    await core.add(hit({ t: T0 + 30 * 60_000 }), 0)
    expect(Object.keys((await core.today('site000001')).hours)).toEqual([
      '2026-10-04T11:00:00.000Z',
    ])
  })

  it('enforces the daily cap', async () => {
    const core = new ShardCore(new MemoryShardStorage())
    expect(await core.add(hit(), 1)).toBe(true)
    expect(await core.add(hit({ t: T0 + 1 }), 1)).toBe(false)
    expect(core.hasUnsaved).toBe(true)
    expect((await core.today('site000001')).pageviews).toBe(1)
  })
})
