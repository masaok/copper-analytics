/** Which Search Console properties a user may see. */
import { bare } from '@/features/google/ranges'

export interface MatchedSite {
  /** The property as Search Console names it: `sc-domain:example.com` or `https://www.example.com/`. */
  siteUrl: string
  /** The bare host, e.g. `example.com`. Used in the URL and as the label. */
  host: string
  projectName: string
}

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

/**
 * The entry for `host`, or else the domain property that covers it, so a link to
 * `shop.example.com` finds `sc-domain:example.com`.
 */
export function siteFor<T extends { site: MatchedSite }>(sites: T[], host: string): T | undefined {
  return (
    sites.find((s) => s.site.host === host) ??
    sites.find((s) => s.site.siteUrl.startsWith('sc-domain:') && host.endsWith(`.${s.site.host}`))
  )
}

/** An average position to one decimal, or a dash when there were no impressions. */
export const position = (p: number) => (p > 0 ? p.toFixed(1) : '–')
