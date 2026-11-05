import { describe, expect, it } from 'vitest'
import {
  domainRows,
  fetchNamecheapDomains,
  maskKey,
  parseDomainList,
  parseNamecheapInput,
} from '../src/features/settings/namecheap'

const page = (names: string[], total: number) => `<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <Errors />
  <CommandResponse Type="namecheap.domains.getList">
    <DomainGetListResult>
      ${names
        .map(
          (name, i) =>
            `<Domain ID="${i}" Name="${name}" User="owner" Created="01/01/2024" Expires="01/01/2027" IsExpired="${i === 0}" IsLocked="false" AutoRenew="true" WhoisGuard="ENABLED" IsPremium="false" IsOurDNS="true"/>`,
        )
        .join('\n')}
    </DomainGetListResult>
    <Paging><TotalItems>${total}</TotalItems><CurrentPage>1</CurrentPage><PageSize>100</PageSize></Paging>
  </CommandResponse>
</ApiResponse>`

describe('parseDomainList', () => {
  it('reads each domain', () => {
    expect(parseDomainList(page(['a.com', 'b&amp;c.io'], 2))).toEqual({
      ok: true,
      total: 2,
      domains: [
        { name: 'a.com', expires: '2027-01-01', isExpired: true, autoRenew: true },
        { name: 'b&c.io', expires: '2027-01-01', isExpired: false, autoRenew: true },
      ],
    })
  })

  it("returns Namecheap's error text", () => {
    const xml = `<ApiResponse Status="ERROR"><Errors><Error Number="1011150">Invalid request IP: 1.2.3.4</Error></Errors></ApiResponse>`
    expect(parseDomainList(xml)).toEqual({ ok: false, error: 'Invalid request IP: 1.2.3.4' })
    expect(parseDomainList('<html>')).toEqual({
      ok: false,
      error: 'Namecheap returned an unreadable response.',
    })
  })
})

describe('domainRows', () => {
  const domain = (name: string, expires: string, isExpired = false) => ({
    name,
    expires,
    isExpired,
    autoRenew: false,
  })
  const blog = { siteKey: 'k1', domains: ['www.Example.com', 'blog.other.io'] }
  const shop = { siteKey: 'k2', domains: ['example.com'] }

  it('marks expiry against today and joins the projects on each domain or its subdomains', () => {
    const rows = domainRows(
      [
        domain('example.com', '2026-11-04'),
        domain('other.io', '2026-12-05'),
        domain('third.net', '2026-12-06'),
        domain('flagged.org', '2030-01-01', true),
        domain('mple.com', '2030-01-01'),
      ],
      [blog, shop],
      new Map(),
      new Date('2026-11-05T12:00:00Z'),
    )
    expect(rows.map((r) => [r.name, r.expiry, r.projects.map((p) => p.siteKey)])).toEqual([
      ['example.com', 'expired', ['k1', 'k2']],
      ['other.io', 'soon', ['k1']],
      ['third.net', 'ok', []],
      ['flagged.org', 'expired', []],
      ['mple.com', 'ok', []],
    ])
  })

  it('takes the stored repository for a domain in any case, and null when none is stored', () => {
    const rows = domainRows(
      [domain('Example.com', '2030-01-01'), domain('other.io', '2030-01-01')],
      [blog, shop],
      new Map([['example.com', 'masaok/example']]),
    )
    expect(rows.map((r) => [r.name, r.repository, r.projects.map((p) => p.siteKey)])).toEqual([
      ['Example.com', 'masaok/example', ['k1', 'k2']],
      ['other.io', null, ['k1']],
    ])
  })
})

describe('fetchNamecheapDomains', () => {
  it('follows pages until it has every domain, sending the allowlisted IP', async () => {
    const names = Array.from({ length: 130 }, (_, i) => `site${i}.com`)
    const urls: URL[] = []
    const fetcher = (async (input: URL) => {
      urls.push(input)
      const n = Number(input.searchParams.get('Page'))
      return new Response(page(names.slice((n - 1) * 100, n * 100), names.length))
    }) as unknown as typeof fetch
    const result = await fetchNamecheapDomains(
      { apiUser: 'me', apiKey: 'k'.repeat(32) },
      '1.2.3.4',
      fetcher,
    )
    expect(result.ok && result.domains.length).toBe(130)
    expect(urls.map((u) => u.searchParams.get('Page'))).toEqual(['1', '2'])
    expect(urls[0]?.searchParams.get('ClientIp')).toBe('1.2.3.4')
    expect(urls[0]?.searchParams.get('Command')).toBe('namecheap.domains.getList')
  })

  it('reports a network failure instead of throwing', async () => {
    const fetcher = (async () => {
      throw new Error('down')
    }) as unknown as typeof fetch
    expect(await fetchNamecheapDomains({ apiUser: 'me', apiKey: 'k' }, '1.2.3.4', fetcher)).toEqual(
      {
        ok: false,
        error: 'Namecheap did not answer. Try again in a minute.',
      },
    )
  })
})

describe('parseNamecheapInput', () => {
  it('trims and accepts a username and key', () => {
    expect(parseNamecheapInput(' me ', ` ${'a1'.repeat(16)} `)).toEqual({
      apiUser: 'me',
      apiKey: 'a1'.repeat(16),
    })
  })

  it('rejects anything that could not be a key', () => {
    expect(parseNamecheapInput('me', 'short')).toHaveProperty('error')
    expect(parseNamecheapInput('me', `${'a'.repeat(20)}&x=1`)).toHaveProperty('error')
    expect(parseNamecheapInput('', 'a'.repeat(32))).toHaveProperty('error')
  })
})

describe('maskKey', () => {
  it('shows the first and last four characters, and hides the length', () => {
    expect(maskKey('abcd0123456789abcdef0123456789wxyz')).toBe('abcd••••••••wxyz')
    expect(maskKey('abcd1234wxyz')).toBe('abcd••••••••wxyz')
  })

  it('shows nothing of a key too short to split', () => {
    expect(maskKey('abcd1234')).toBe('••••••••')
  })
})
