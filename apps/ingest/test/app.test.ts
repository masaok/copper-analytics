import {
  type ConfigCache,
  defaultFilter,
  type FlushUnit,
  HOUR_MS,
  type ProjectConfig,
  ProjectDirectory,
  SHARD_COUNT,
  type Store,
  shardOf,
} from '@copper/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { MemoryShardStorage, ShardCore } from '../src/shard-core'

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const SITE = 'k3x9q2m7ab'
const T0 = Date.UTC(2026, 9, 4, 10, 15, 0)

let now: number
let shards: ShardCore[]
let loads: string[]
let stored: { shard: number; units: FlushUnit[] }[]
let storeOpens: number
let failStore: boolean
let revalidated: string[][]
let app: ReturnType<typeof createApp>

const projects: Record<string, ProjectConfig> = {
  [SITE]: { siteKey: SITE, domains: ['acme.io'], dailyCap: 3 },
}

beforeEach(() => {
  now = T0
  shards = Array.from(
    { length: SHARD_COUNT },
    () => new ShardCore(new MemoryShardStorage(), () => now),
  )
  loads = []
  stored = []
  storeOpens = 0
  failStore = false
  revalidated = []
  const store: Store = {
    projectConfig: async () => null,
    runDaily: async (at) => ({
      day: at.toISOString().slice(0, 10),
      deleted: { statsHourly: 0, breakdownDaily: 0, breakdownMonthly: 0, flushLog: 0 },
      monthsRolled: 0,
      databaseBytes: 1,
    }),
    applyFlush: async (shard, units) => {
      if (failStore) throw new Error('database down')
      stored.push({ shard, units })
      return { applied: units.map((u) => u.flushId), skipped: [] }
    },
  }
  app = createApp({
    projects: new ProjectDirectory(
      async (key) => {
        loads.push(key)
        return projects[key] ?? null
      },
      undefined,
      () => now,
    ),
    filter: defaultFilter,
    shard: (i) => shards[i] as ShardCore,
    openStore: async () => {
      storeOpens++
      return { store, close: async () => {} }
    },
    ingestSecret: 'secret',
    revalidate: async (keys) => {
      revalidated.push(keys)
    },
    clock: () => now,
  })
})

const pageview = (over: { body?: unknown; headers?: Record<string, string> } = {}) =>
  app.fetch(
    new Request('https://e.copper.test/e', {
      method: 'POST',
      headers: {
        'User-Agent': CHROME,
        Origin: 'https://acme.io',
        'CF-Connecting-IP': '203.0.113.7',
        ...over.headers,
      },
      body: JSON.stringify(
        over.body ?? { s: SITE, u: 'https://acme.io/pricing', r: 'https://t.co/a', w: 1440 },
      ),
    }),
  )
const get = (path: string, secret = 'secret') =>
  app.fetch(
    new Request(`https://e.copper.test${path}`, { headers: { Authorization: `Bearer ${secret}` } }),
  )
const today = async () =>
  (await get(`/today?site=${SITE}`)).json() as Promise<{ pageviews: number }>

describe('POST /e', () => {
  it('counts a pageview and answers 204 with CORS headers', async () => {
    const res = await pageview()
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(await (await get(`/live?site=${SITE}`)).json()).toEqual({ live: 1 })
    expect(await (await get(`/today?site=${SITE}`)).json()).toMatchObject({
      pageviews: 1,
      visitors: 1,
      breakdown: {
        page: { '/pricing': [1, 1] },
        referrer: { 't.co': [1, 1] },
        device: { desktop: [1, 1] },
      },
    })
  })

  it('answers 204 and counts nothing for bots, foreign origins, unknown sites and junk', async () => {
    const dropped = [
      await pageview({
        headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
      }),
      await pageview({ headers: { Origin: 'https://evil.example' } }),
      await pageview({ body: { s: 'zzzzzzzzzz', u: 'https://acme.io/' } }),
      await pageview({ body: { s: SITE, u: 'javascript:alert(1)' } }),
      await pageview({ body: 'not an object' }),
    ]
    expect(dropped.map((r) => r.status)).toEqual([204, 204, 204, 204, 204])
    expect((await today()).pageviews).toBe(0)
  })

  it('stops counting at the daily cap', async () => {
    for (let i = 0; i < 5; i++) await pageview()
    expect((await today()).pageviews).toBe(3)
  })

  it('looks a site key up once, then serves it from memory, including unknown keys', async () => {
    await pageview()
    await pageview()
    await pageview({ body: { s: 'zzzzzzzzzz', u: 'https://acme.io/' } })
    await pageview({ body: { s: 'zzzzzzzzzz', u: 'https://acme.io/' } })
    expect(loads).toEqual([SITE, 'zzzzzzzzzz'])
    now += 6 * 60_000
    await pageview()
    expect(loads).toEqual([SITE, 'zzzzzzzzzz', SITE])
  })

  it('ignores a body larger than a pageview can be', async () => {
    const res = await pageview({ body: { s: SITE, u: 'https://acme.io/', pad: 'x'.repeat(9000) } })
    expect(res.status).toBe(204)
    expect((await today()).pageviews).toBe(0)
  })

  it('keeps serving a known project when junk keys use up the lookup budget', async () => {
    await pageview()
    now += 6 * 60_000
    for (let i = 0; i < 40; i++) {
      await pageview({ body: { s: `junk${String(i).padStart(6, '0')}`, u: 'https://acme.io/' } })
    }
    await pageview({ headers: { 'CF-Connecting-IP': '203.0.113.9' } })
    expect((await today()).pageviews).toBe(2)
  })

  it('rejects other methods', async () => {
    expect((await app.fetch(new Request('https://e.copper.test/e'))).status).toBe(405)
    const options = await app.fetch(new Request('https://e.copper.test/e', { method: 'OPTIONS' }))
    expect(options.status).toBe(204)
  })
})

describe('private routes', () => {
  it('require the shared secret', async () => {
    expect((await get(`/live?site=${SITE}`, 'wrong')).status).toBe(401)
    expect((await get(`/today?site=${SITE}`, 'wrong')).status).toBe(401)
    const flush = await app.fetch(new Request('https://e.copper.test/flush', { method: 'POST' }))
    expect(flush.status).toBe(401)
    expect((await app.fetch(new Request('https://e.copper.test/nope'))).status).toBe(404)
  })

  it('drop a cached project on /invalidate', async () => {
    await pageview()
    await app.fetch(
      new Request(`https://e.copper.test/invalidate?site=${SITE}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer secret' },
      }),
    )
    await pageview()
    expect(loads).toEqual([SITE, SITE])
  })
})

describe('GET /overview', () => {
  it('returns live visitors and unflushed counters for several projects in one call', async () => {
    await pageview()
    await pageview({ headers: { 'CF-Connecting-IP': '203.0.113.8' } })
    const res = await get(`/overview?sites=${SITE},zzzzzzzzzz`)
    expect(await res.json()).toEqual({
      [SITE]: { live: 2, pageviews: 2, dayVisitors: 2 },
      zzzzzzzzzz: { live: 0, pageviews: 0, dayVisitors: 0 },
    })
    expect((await get(`/overview?sites=${SITE}`, 'wrong')).status).toBe(401)
  })
})

describe('flush', () => {
  it('does not open the database when nothing is pending', async () => {
    await pageview()
    const report = await app.runFlush()
    expect(report).toMatchObject({ shards: 0, applied: 0 })
    expect(storeOpens).toBe(0)
  })

  it('stores finished hours, acks them and tells the web app which projects changed', async () => {
    await pageview()
    now = T0 + HOUR_MS
    const report = await app.runFlush()
    expect(report).toMatchObject({
      shards: 1,
      applied: 1,
      skipped: 0,
      siteKeys: [SITE],
      failed: [],
    })
    expect(stored).toHaveLength(1)
    expect(stored[0]?.shard).toBe(shardOf(SITE))
    expect(stored[0]?.units[0]).toMatchObject({ flushId: '2026-10-04T10:00:00.000Z' })
    expect(revalidated).toEqual([[SITE]])
    expect((await app.runFlush()).applied).toBe(0)
  })

  it('keeps the hour buffered when the database write fails, and stores it on the next run', async () => {
    await pageview()
    now = T0 + HOUR_MS
    failStore = true
    const failed = await app.runFlush()
    expect(failed.failed).toEqual([{ shard: shardOf(SITE), error: 'database down' }])
    expect(revalidated).toEqual([])
    expect((await today()).pageviews).toBe(1)

    failStore = false
    now = T0 + 2 * HOUR_MS
    const retry = await app.runFlush()
    expect(retry.applied).toBe(1)
    expect(stored[0]?.units[0]?.flushId).toBe('2026-10-04T10:00:00.000Z')
    expect((await today()).pageviews).toBe(0)
  })

  it('runs the daily job even with nothing to flush', async () => {
    const report = await app.runFlush({ daily: true })
    expect(report.daily).toMatchObject({ day: '2026-10-04' })
    expect(storeOpens).toBe(1)
  })
})

describe('ProjectDirectory', () => {
  it('reads through to the KV cache and writes results back, including unknown keys', async () => {
    const kv = new Map<string, string>()
    const puts: [string, number | undefined][] = []
    const cache: ConfigCache = {
      get: async (k) => kv.get(k) ?? null,
      put: async (k, v, o) => {
        kv.set(k, v)
        puts.push([k, o?.expirationTtl])
      },
      delete: async (k) => {
        kv.delete(k)
      },
    }
    const dbLoads: string[] = []
    const load = async (k: string) => {
      dbLoads.push(k)
      return projects[k] ?? null
    }
    const first = new ProjectDirectory(load, cache)
    expect(await first.get(SITE)).toEqual(projects[SITE])
    expect(await first.get('zzzzzzzzzz')).toBeNull()
    expect(puts).toEqual([
      [SITE, 7 * 86_400],
      ['zzzzzzzzzz', 3600],
    ])
    // A second isolate finds both answers in KV and never reaches the database.
    const second = new ProjectDirectory(load, cache)
    expect(await second.get(SITE)).toEqual(projects[SITE])
    expect(await second.get('zzzzzzzzzz')).toBeNull()
    expect(dbLoads).toEqual([SITE, 'zzzzzzzzzz'])
  })

  it('stops asking the database after 30 lookups in a window', async () => {
    let calls = 0
    const directory = new ProjectDirectory(async () => {
      calls++
      return null
    })
    for (let i = 0; i < 50; i++) await directory.get(`junk${String(i).padStart(6, '0')}`)
    expect(calls).toBe(30)
  })
})
