import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  defaultFilter,
  flush,
  generateSiteKey,
  localDay,
  MemoryBuffer,
  mergeBreakdown,
  monthOf,
  OTHER,
  originAllowed,
  parsePayload,
  parseUserAgent,
  referrerDomain,
  SITE_KEY_PATTERN,
  type Store,
  shardOf,
  toHit,
  topEntries,
  truncateBreakdown,
  visitorId,
} from '../src'

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

describe('user agent', () => {
  it('classifies common browsers', () => {
    expect(parseUserAgent(CHROME)).toEqual({ device: 'desktop', browser: 'Chrome', os: 'macOS' })
    expect(parseUserAgent(IPHONE)).toEqual({ device: 'mobile', browser: 'Safari', os: 'iOS' })
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
      ),
    ).toEqual({ device: 'desktop', browser: 'Firefox', os: 'Windows' })
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      ),
    ).toEqual({ device: 'tablet', browser: 'Chrome', os: 'Android' })
  })
})

describe('urls', () => {
  it('reduces a referrer to its domain and drops same-site referrers', () => {
    expect(referrerDomain('https://www.google.com/search?q=x', 'https://acme.io/')).toBe(
      'google.com',
    )
    expect(referrerDomain('https://acme.io/pricing', 'https://www.acme.io/')).toBe('')
    expect(referrerDomain('not a url', 'https://acme.io/')).toBe('')
    expect(referrerDomain(undefined, 'https://acme.io/')).toBe('')
  })

  it('matches origins against project domains, including subdomains', () => {
    expect(originAllowed('https://acme.io', ['acme.io'])).toBe(true)
    expect(originAllowed('https://shop.acme.io', ['acme.io'])).toBe(true)
    expect(originAllowed('https://www.acme.io', ['www.acme.io'])).toBe(true)
    expect(originAllowed('https://notacme.io', ['acme.io'])).toBe(false)
    expect(originAllowed('https://evil.com', ['acme.io'])).toBe(false)
    expect(originAllowed('https://anything.dev', [])).toBe(true)
  })
})

describe('payload', () => {
  it('accepts a well-formed pageview and rejects everything else', () => {
    expect(parsePayload({ s: 'k3x9q2m7ab', u: 'https://acme.io/a?b=1', r: '', w: 1440 })).toEqual({
      s: 'k3x9q2m7ab',
      u: 'https://acme.io/a?b=1',
      r: '',
      w: 1440,
    })
    expect(parsePayload({ s: 'short', u: 'https://acme.io/' })).toBeNull()
    expect(parsePayload({ s: 'k3x9q2m7ab', u: 'javascript:alert(1)' })).toBeNull()
    expect(parsePayload({ s: 'k3x9q2m7ab', u: `https://acme.io/${'x'.repeat(3000)}` })).toBeNull()
    expect(parsePayload('nope')).toBeNull()
    expect(parsePayload(null)).toBeNull()
  })

  it('keeps the path, referrer domain and utm source and nothing more of the URL', () => {
    const hit = toHit(
      {
        s: 'k3x9q2m7ab',
        u: 'https://acme.io/pricing?utm_source=HN&email=a@b.c',
        r: 'https://t.co/x',
      },
      { userAgent: IPHONE, ip: '203.0.113.9', country: 'DE', now: 5 },
    )
    expect(hit).toEqual({
      k: 'k3x9q2m7ab',
      t: 5,
      p: '/pricing',
      r: 't.co',
      c: 'DE',
      d: 'mobile',
      b: 'Safari',
      o: 'iOS',
      u: 'hn',
      ip: '203.0.113.9',
      ua: IPHONE,
    })
  })
})

describe('hashing', () => {
  it('derives a stable 16-hex visitor id that changes with the salt', async () => {
    const a = await visitorId('salt1', 'k3x9q2m7ab', '203.0.113.9', CHROME)
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    expect(await visitorId('salt1', 'k3x9q2m7ab', '203.0.113.9', CHROME)).toBe(a)
    expect(await visitorId('salt2', 'k3x9q2m7ab', '203.0.113.9', CHROME)).not.toBe(a)
    expect(await visitorId('salt1', 'otherkey00', '203.0.113.9', CHROME)).not.toBe(a)
  })

  it('generates site keys in the public format and spreads them over 16 shards', () => {
    const shards = new Set<number>()
    for (let i = 0; i < 400; i++) {
      const key = generateSiteKey()
      expect(key).toMatch(SITE_KEY_PATTERN)
      shards.add(shardOf(key))
    }
    expect(shards.size).toBe(16)
    expect(shardOf('k3x9q2m7ab')).toBe(shardOf('k3x9q2m7ab'))
  })
})

describe('filter', () => {
  const project = { siteKey: 'k3x9q2m7ab', domains: ['acme.io'], dailyCap: 0 }
  const base = { ip: '203.0.113.9', referrer: '', project }
  it('rejects bots and foreign origins', () => {
    expect(
      defaultFilter.reject({ ...base, userAgent: CHROME, origin: 'https://acme.io' }),
    ).toBeNull()
    expect(
      defaultFilter.reject({ ...base, userAgent: 'Googlebot/2.1', origin: 'https://acme.io' }),
    ).toBe('bot')
    expect(defaultFilter.reject({ ...base, userAgent: '', origin: 'https://acme.io' })).toBe('bot')
    expect(defaultFilter.reject({ ...base, userAgent: CHROME, origin: 'https://evil.com' })).toBe(
      'origin',
    )
  })
})

describe('top-N', () => {
  it('merges tallies and truncates into (other)', () => {
    const merged = mergeBreakdown(
      { page: { '/': [5, 3], '/a': [1, 1] } },
      { page: { '/': [2, 1], '/b': [4, 2], [OTHER]: [3, 3] }, country: { US: [6, 3] } },
    )
    expect(merged).toEqual({
      page: { '/': [7, 4], '/a': [1, 1], '/b': [4, 2], [OTHER]: [3, 3] },
      country: { US: [6, 3] },
    })
    expect(truncateBreakdown(merged, 2).page).toEqual({
      '/': [7, 4],
      '/b': [4, 2],
      [OTHER]: [4, 4],
    })
    expect(topEntries(merged, 'page', 3).map((r) => r.key)).toEqual(['/', '/b', '/a'])
  })
})

describe('time', () => {
  it('buckets an instant into the project timezone', () => {
    const t = Date.UTC(2026, 9, 5, 3, 0)
    expect(localDay(t, 'UTC')).toBe('2026-10-05')
    expect(localDay(t, 'America/Los_Angeles')).toBe('2026-10-04')
    expect(localDay(t, 'Not/AZone')).toBe('2026-10-05')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(monthOf('2026-10-17')).toBe('2026-10-01')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
  })
})

describe('MemoryBuffer and flush', () => {
  const hit = (ip: string, t: number) =>
    toHit(
      { s: 'k3x9q2m7ab', u: 'https://acme.io/' },
      { userAgent: CHROME, ip, country: 'US', now: t },
    )

  it('keeps a unit pending with the same id until the store confirms it', async () => {
    const T = Date.UTC(2026, 9, 4, 10, 5)
    const buffer = new MemoryBuffer(() => T)
    await buffer.add(hit('203.0.113.1', T), 0)
    await buffer.add(hit('203.0.113.2', T), 0)
    expect(await buffer.live('k3x9q2m7ab')).toBe(2)

    const calls: string[][] = []
    let fail = true
    const store: Store = {
      projectConfig: async () => null,
      runDaily: async () => {
        throw new Error('unused')
      },
      applyFlush: async (_shard, units) => {
        calls.push(units.map((u) => u.flushId))
        if (fail) throw new Error('database down')
        return { applied: units.map((u) => u.flushId), skipped: [] }
      },
    }
    await expect(flush(buffer, store, 0, T)).rejects.toThrow('database down')
    fail = false
    const result = await flush(buffer, store, 0, T)
    expect(result.applied).toEqual(calls[0])
    expect(calls[1]).toEqual(calls[0])
    expect(await buffer.pending(T)).toEqual([])
  })
})
