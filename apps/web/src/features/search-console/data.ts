import 'server-only'
import { createSign } from 'node:crypto'
import { unstable_cache } from 'next/cache'
import type { ProjectSummary } from '@/features/projects/queries'
import { env } from '@/lib/env'
import { daysBetween, type MatchedSite, matchSites, searchWindow } from './sites'

const API = 'https://www.googleapis.com/webmasters/v3'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
/** Search Console updates once or twice a day, so an hour-old answer is as good as a new one. */
const LIFETIME = 3600

export interface SearchRow {
  key: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SiteSearch {
  site: MatchedSite
  totals: Omit<SearchRow, 'key'>
  /** Clicks and impressions per day, one entry for every day in the window. */
  daily: { day: string; clicks: number; impressions: number }[]
  queries: SearchRow[]
  pages: SearchRow[]
  error?: string
}

let token: { value: string; expires: number } | undefined

/** An access token from the service account's key (a signed JWT exchanged at Google), reused until it nearly expires. */
async function accessToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value
  const account = env().searchConsole
  if (!account) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: account.clientEmail,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.privateKey, 'base64url')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
    cache: 'no-store',
  })
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string }
  if (!body.access_token) throw new Error(`Google sign-in failed: ${body.error ?? res.status}`)
  token = { value: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 }
  return token.value
}

async function google<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(detail?.error?.message ?? `Search Console answered ${res.status}`)
  }
  return (await res.json()) as T
}

/** Every property the service account has been added to. */
const cachedSiteUrls = unstable_cache(
  async () => {
    const { siteEntry = [] } = await google<{ siteEntry?: { siteUrl: string }[] }>('/sites')
    return siteEntry.map((s) => s.siteUrl)
  },
  ['search-console', 'sites'],
  { revalidate: LIFETIME },
)

interface ApiRow {
  keys?: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

const query = (siteUrl: string, from: string, to: string, dimension?: string, rowLimit = 10) =>
  google<{ rows?: ApiRow[] }>(`/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    startDate: from,
    endDate: to,
    dimensions: dimension ? [dimension] : [],
    rowLimit,
    dataState: 'all',
  }).then(({ rows = [] }) =>
    rows.map(
      (r): SearchRow => ({
        key: r.keys?.[0] ?? '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }),
    ),
  )

/**
 * The ten rows with the most clicks, then the most impressions. Google orders by clicks alone,
 * so a site with few clicks would otherwise list its zero-click rows alphabetically.
 */
const top = (rows: SearchRow[]) =>
  rows.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 10)

/** One property's numbers. A failure throws, and is not cached, so the next request retries. */
const cachedSite = (site: MatchedSite, from: string, to: string) =>
  unstable_cache(
    async (): Promise<SiteSearch> => {
      const [totals, byDay, queries, pages] = await Promise.all([
        query(site.siteUrl, from, to),
        query(site.siteUrl, from, to, 'date', 500),
        query(site.siteUrl, from, to, 'query', 250).then(top),
        query(site.siteUrl, from, to, 'page', 250).then(top),
      ])
      const days = new Map(byDay.map((r) => [r.key, r]))
      return {
        site,
        totals: totals[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        daily: daysBetween(from, to).map((day) => ({
          day,
          clicks: days.get(day)?.clicks ?? 0,
          impressions: days.get(day)?.impressions ?? 0,
        })),
        queries,
        pages,
      }
    },
    ['search-console', site.siteUrl, from, to],
    { revalidate: LIFETIME },
  )()

export interface SearchConsole {
  window: { from: string; to: string }
  sites: SiteSearch[]
  error?: string
}

/**
 * Search Console data for each property that matches one of the user's project domains.
 * Returns null when no service account is configured. A failing property reports its own error.
 */
export async function loadSearchConsole(
  projects: ProjectSummary[],
  days: number,
): Promise<SearchConsole | null> {
  if (!env().searchConsole) return null
  const window = searchWindow(days)
  let siteUrls: string[]
  try {
    siteUrls = await cachedSiteUrls()
  } catch (error) {
    return { window, sites: [], error: (error as Error).message }
  }
  const sites = await Promise.all(
    matchSites(siteUrls, projects).map((site) =>
      cachedSite(site, window.from, window.to).catch(
        (error: Error): SiteSearch => ({
          site,
          totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
          daily: [],
          queries: [],
          pages: [],
          error: error.message,
        }),
      ),
    ),
  )
  return { window, sites }
}
