/** Whether a domain has Google Analytics and Search Console set up, from what the service account can read. */
import { propertyHost } from '@/features/search-console/sites'
import { bare, covers } from './ranges'

export interface GoogleLists {
  /** Web-stream hosts of every Analytics property, already bare. */
  analyticsHosts: string[]
  /** Every Search Console property, as Search Console names it. */
  siteUrls: string[]
}

export type GoogleSetupLists =
  | { kind: 'off' }
  | { kind: 'error'; error: string }
  | ({ kind: 'ok' } & GoogleLists)

/**
 * A domain is set up for Analytics when a web stream is on it or a subdomain, and for Search
 * Console when a property is on it or a subdomain, or a domain property covers it.
 */
export function googleSetup(
  domain: string,
  { analyticsHosts, siteUrls }: GoogleLists,
): { analytics: boolean; searchConsole: boolean } {
  const name = bare(domain)
  return {
    analytics: analyticsHosts.some((host) => covers(host, name)),
    searchConsole: siteUrls.some((siteUrl) => {
      const host = propertyHost(siteUrl)
      if (!host) return false
      return covers(host, name) || (siteUrl.startsWith('sc-domain:') && name.endsWith(`.${host}`))
    }),
  }
}
