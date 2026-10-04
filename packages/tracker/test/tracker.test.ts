import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { MAX_GZIP_BYTES, trackerScript } from '../src'

interface Page {
  href: string
  referrer?: string
  attrs?: Record<string, string>
  ignoreElement?: boolean
  optOut?: boolean
  protocol?: string
}

/** Runs the tracker against a hand-built window. Returns what it sent and handles to navigate. */
function run(page: Page, endpoint = '') {
  const sent: { url: string; body: Record<string, unknown> }[] = []
  const listeners: Record<string, () => void> = {}
  const attrs: Record<string, string> = { 'data-site': 'k3x9q2m7ab', ...page.attrs }
  const location = new URL(page.href) as unknown as {
    href: string
    hostname: string
    protocol: string
  }
  const loc = {
    get href() {
      return location.href
    },
    get hostname() {
      return location.hostname
    },
    protocol: page.protocol ?? location.protocol,
  }
  const history = {
    pushState(_state: unknown, _title: string, url: string) {
      location.href = new URL(url, location.href).href
    },
  }
  const window = {
    location: loc,
    innerWidth: 1280,
    localStorage: { getItem: () => (page.optOut ? '1' : null) },
    addEventListener: (name: string, fn: () => void) => {
      listeners[name] = fn
    },
  }
  const document = {
    referrer: page.referrer ?? '',
    currentScript: {
      src: 'https://app.copper.test/c.js',
      getAttribute: (name: string) => attrs[name] ?? null,
      hasAttribute: (name: string) => name in attrs,
    },
    querySelector: () => (page.ignoreElement ? {} : null),
  }
  const navigator = {
    sendBeacon: (url: string, body: string) => {
      sent.push({ url, body: JSON.parse(body) })
      return true
    },
  }
  new Function('window', 'document', 'navigator', 'history', 'location', trackerScript(endpoint))(
    window,
    document,
    navigator,
    history,
    loc,
  )
  return {
    sent,
    history,
    back: (url: string) => {
      location.href = url
      listeners.popstate?.()
    },
  }
}

describe('c.js', () => {
  it(`is at most ${MAX_GZIP_BYTES} bytes gzipped`, () => {
    const size = gzipSync(trackerScript('https://e.copperanalytics.com/e')).length
    expect(size).toBeLessThanOrEqual(MAX_GZIP_BYTES)
    expect(size).toBeGreaterThan(200)
  })

  it('sends one pageview to /api/e on the script origin by default', () => {
    const { sent } = run({
      href: 'https://acme.io/pricing?utm_source=hn',
      referrer: 'https://t.co/x',
    })
    expect(sent).toEqual([
      {
        url: 'https://app.copper.test/api/e',
        body: {
          s: 'k3x9q2m7ab',
          u: 'https://acme.io/pricing?utm_source=hn',
          r: 'https://t.co/x',
          w: 1280,
        },
      },
    ])
  })

  it('posts to the baked-in endpoint, and data-api overrides it', () => {
    expect(run({ href: 'https://acme.io/' }, 'https://e.copper.test/e').sent[0]?.url).toBe(
      'https://e.copper.test/e',
    )
    expect(
      run(
        { href: 'https://acme.io/', attrs: { 'data-api': '/stats/e' } },
        'https://e.copper.test/e',
      ).sent[0]?.url,
    ).toBe('/stats/e')
  })

  it('counts pushState and popstate navigation, with the previous page as referrer', () => {
    const { sent, history, back } = run({ href: 'https://acme.io/' })
    history.pushState({}, '', '/docs')
    history.pushState({}, '', '/docs')
    back('https://acme.io/')
    expect(sent.map((s) => [s.body.u, s.body.r])).toEqual([
      ['https://acme.io/', ''],
      ['https://acme.io/docs', 'https://acme.io/'],
      ['https://acme.io/', 'https://acme.io/docs'],
    ])
  })

  it('stays silent on localhost, file pages, ignored pages and opted-out browsers', () => {
    expect(run({ href: 'http://localhost:3000/' }).sent).toEqual([])
    expect(run({ href: 'http://127.0.0.1:8080/' }).sent).toEqual([])
    expect(run({ href: 'https://acme.io/', protocol: 'file:' }).sent).toEqual([])
    expect(run({ href: 'https://acme.io/', ignoreElement: true }).sent).toEqual([])
    expect(run({ href: 'https://acme.io/', optOut: true }).sent).toEqual([])
  })

  it('counts localhost when data-dev is set', () => {
    expect(run({ href: 'http://localhost:3000/', attrs: { 'data-dev': '' } }).sent).toHaveLength(1)
  })
})
