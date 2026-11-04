/** Pure helpers for the Search Console page: which properties a user may see, and which days. */

export const SEARCH_RANGES = { '7d': 7, '28d': 28, '3m': 90 } as const
export type SearchRangeId = keyof typeof SEARCH_RANGES

export const isSearchRangeId = (value: unknown): value is SearchRangeId =>
  typeof value === 'string' && Object.hasOwn(SEARCH_RANGES, value)

export interface MatchedSite {
  /** The property as Search Console names it: `sc-domain:example.com` or `https://www.example.com/`. */
  siteUrl: string
  /** The bare host, e.g. `example.com`. Used in the URL and as the label. */
  host: string
  projectName: string
}

const bare = (host: string) => host.toLowerCase().replace(/^www\./, '')

/** `sc-domain:example.com` and `https://www.example.com/` both become `example.com`. */
export function propertyHost(siteUrl: string): string | null {
  if (siteUrl.startsWith('sc-domain:')) return bare(siteUrl.slice('sc-domain:'.length))
  try {
    return bare(new URL(siteUrl).hostname)
  } catch {
    return null
  }
}

/**
 * The Search Console properties that cover one of the user's project domains, one per host.
 * A domain property also covers subdomains, so `sc-domain:example.com` matches `shop.example.com`.
 * A domain property wins over a URL-prefix property for the same host, because it counts more.
 */
export function matchSites(
  siteUrls: string[],
  projects: { name: string; domains: string[] }[],
): MatchedSite[] {
  const byHost = new Map<string, MatchedSite>()
  for (const siteUrl of siteUrls) {
    const host = propertyHost(siteUrl)
    if (!host) continue
    const isDomain = siteUrl.startsWith('sc-domain:')
    const project = projects.find((p) =>
      p.domains.some((d) => {
        const domain = bare(d)
        return domain === host || (isDomain && domain.endsWith(`.${host}`))
      }),
    )
    if (!project) continue
    const existing = byHost.get(host)
    if (existing?.siteUrl.startsWith('sc-domain:')) continue
    byHost.set(host, { siteUrl, host, projectName: project.name })
  }
  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host))
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** The last `days` whole days, ending yesterday (UTC), as Search Console's YYYY-MM-DD dates. */
export function searchWindow(days: number, now = Date.now()): { from: string; to: string } {
  const day = 86_400_000
  const yesterday = now - day
  return { from: isoDay(yesterday - (days - 1) * day), to: isoDay(yesterday) }
}

/** Every day from `from` to `to`, inclusive, so days with no search traffic still plot as zero. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) out.push(isoDay(t))
  return out
}
