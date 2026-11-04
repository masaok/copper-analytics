/** Which Google Analytics properties a user may see. */
import { bare } from '@/features/google/ranges'

export interface AnalyticsProperty {
  /** `properties/123`, as the Analytics APIs name it. */
  id: string
  displayName: string
  /** Hosts of the property's web streams, e.g. `https://www.example.com` becomes `example.com`. */
  hosts: string[]
}

export interface MatchedProperty {
  id: string
  /** The stream host that matched, used in the URL and as the label. */
  host: string
  projectName: string
}

const hostOf = (uri: string) => {
  try {
    return bare(new URL(uri).hostname)
  } catch {
    return null
  }
}

/** The hosts of a property's web stream URIs, without duplicates or unparseable ones. */
export const streamHosts = (uris: (string | undefined)[]): string[] => [
  ...new Set(uris.flatMap((uri) => (uri ? (hostOf(uri) ?? []) : []))),
]

/**
 * The Analytics properties with a web stream on one of the user's project domains, one per host.
 * Unlike a Search Console domain property, a stream on `example.com` does not cover `shop.example.com`.
 */
export function matchProperties(
  properties: AnalyticsProperty[],
  projects: { name: string; domains: string[] }[],
): MatchedProperty[] {
  const byHost = new Map<string, MatchedProperty>()
  for (const property of properties) {
    for (const host of property.hosts) {
      const project = projects.find((p) => p.domains.some((d) => bare(d) === host))
      if (project && !byHost.has(host)) {
        byHost.set(host, { id: property.id, host, projectName: project.name })
      }
    }
  }
  return [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host))
}
