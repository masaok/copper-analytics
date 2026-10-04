const MAX_PATH = 200

const stripWww = (host: string): string => host.toLowerCase().replace(/^www\./, '')

export const hostOf = (url: string): string => {
  try {
    return stripWww(new URL(url).hostname)
  } catch {
    return ''
  }
}

/** Path with the query string and fragment stripped, capped in length. */
export function pathOf(url: string): string {
  try {
    const path = new URL(url).pathname || '/'
    return path.length > MAX_PATH ? path.slice(0, MAX_PATH) : path
  } catch {
    return '/'
  }
}

export function utmSourceOf(url: string): string {
  try {
    const params = new URL(url).searchParams
    return (params.get('utm_source') ?? params.get('ref') ?? '').slice(0, 64).toLowerCase()
  } catch {
    return ''
  }
}

/** Referrer reduced to its domain. Same-site and unparseable referrers become ''. */
export function referrerDomain(referrer: string | undefined, pageUrl: string): string {
  if (!referrer) return ''
  const host = hostOf(referrer)
  return host && host !== hostOf(pageUrl) ? host : ''
}

/** True when `origin` (a URL or bare host) is one of the project's domains or a subdomain of one. */
export function originAllowed(origin: string, domains: string[]): boolean {
  if (domains.length === 0) return true
  const host = origin.includes('://') ? hostOf(origin) : stripWww(origin)
  if (!host) return false
  return domains.some((d) => {
    const domain = stripWww(d.trim())
    return host === domain || host.endsWith(`.${domain}`)
  })
}
