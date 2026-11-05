const API_URL = 'https://api.namecheap.com/xml.response'
/** Namecheap's largest page. */
const PAGE_SIZE = 100
/** 50 pages is 5000 domains, far past any account this page is for. */
const MAX_PAGES = 50

export interface NamecheapDomain {
  name: string
  expires: string
  isExpired: boolean
  autoRenew: boolean
}

export type DomainList =
  | { ok: true; domains: NamecheapDomain[]; total: number }
  | { ok: false; error: string }

const API_USER = /^[A-Za-z0-9_.-]{1,64}$/
const API_KEY = /^[A-Za-z0-9]{16,64}$/

/** Checks the form. Returns the cleaned values, or the message to show. */
export function parseNamecheapInput(
  apiUser: string,
  apiKey: string,
): { apiUser: string; apiKey: string } | { error: string } {
  const user = apiUser.trim()
  const key = apiKey.trim()
  if (!API_USER.test(user)) return { error: 'Enter your Namecheap username.' }
  if (!API_KEY.test(key)) {
    return { error: 'That does not look like a Namecheap API key: letters and digits only.' }
  }
  return { apiUser: user, apiKey: key }
}

/**
 * Enough of a key to tell which one is stored: its first and last four characters. The middle is
 * a fixed run of dots, so the mask does not reveal the key's length.
 */
export function maskKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 4)}${'•'.repeat(8)}${key.slice(-4)}` : '•'.repeat(8)
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}
const decode = (text: string) =>
  text.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e] ?? '')

const attributes = (tag: string): Record<string, string> =>
  Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, decode(v ?? '')]))

/** Reads one page of a `namecheap.domains.getList` response. */
export function parseDomainList(xml: string): DomainList {
  const status = /<ApiResponse\b[^>]*\bStatus="(\w+)"/.exec(xml)?.[1]
  if (status !== 'OK') {
    const errors = [...xml.matchAll(/<Error\b[^>]*>([\s\S]*?)<\/Error>/g)].map((m) =>
      decode((m[1] ?? '').trim()),
    )
    return { ok: false, error: errors.join(' ') || 'Namecheap returned an unreadable response.' }
  }
  const domains = [...xml.matchAll(/<Domain\b([^>]*?)\/?>/g)].map((m) => {
    const a = attributes(m[1] ?? '')
    return {
      name: a.Name ?? '',
      expires: a.Expires ?? '',
      isExpired: a.IsExpired === 'true',
      autoRenew: a.AutoRenew === 'true',
    }
  })
  const total = Number(/<TotalItems>(\d+)<\/TotalItems>/.exec(xml)?.[1] ?? domains.length)
  return { ok: true, domains: domains.filter((d) => d.name), total }
}

/**
 * Every domain in the account. Namecheap only answers calls from an IP address on the account's
 * API allowlist, and wants that address in the request, so `clientIp` is this server's address.
 */
export async function fetchNamecheapDomains(
  credentials: { apiUser: string; apiKey: string },
  clientIp: string,
  fetcher: typeof fetch = fetch,
): Promise<DomainList> {
  const domains: NamecheapDomain[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(API_URL)
    url.search = new URLSearchParams({
      ApiUser: credentials.apiUser,
      ApiKey: credentials.apiKey,
      UserName: credentials.apiUser,
      ClientIp: clientIp,
      Command: 'namecheap.domains.getList',
      PageSize: String(PAGE_SIZE),
      Page: String(page),
      SortBy: 'NAME',
    }).toString()
    let xml: string
    try {
      const response = await fetcher(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })
      xml = await response.text()
    } catch {
      return { ok: false, error: 'Namecheap did not answer. Try again in a minute.' }
    }
    const result = parseDomainList(xml)
    if (!result.ok) return result
    domains.push(...result.domains)
    if (result.domains.length < PAGE_SIZE || domains.length >= result.total) {
      return { ok: true, domains, total: result.total }
    }
  }
  return { ok: true, domains, total: domains.length }
}

/** This server's public IPv4 address, the one to add to Namecheap's API allowlist. */
export async function outboundIp(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetcher('https://api.ipify.org', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    const ip = (await response.text()).trim()
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip : null
  } catch {
    return null
  }
}
