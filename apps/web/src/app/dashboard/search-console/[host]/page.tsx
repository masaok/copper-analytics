import { formatNumber } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { bare, GOOGLE_RANGES } from '@/features/google/ranges'
import {
  Overview,
  percent,
  RangeNav,
  RankedTable,
  rangeParam,
  shortDay,
} from '@/features/google/ui'
import { cachedProjects } from '@/features/projects/queries'
import { loadSearchConsole, type SearchRow } from '@/features/search-console/data'
import { position, siteFor } from '@/features/search-console/sites'
import { requireUser } from '@/lib/auth'

export async function generateMetadata({
  params,
}: PageProps<'/dashboard/search-console/[host]'>): Promise<Metadata> {
  const { host } = await params
  return { title: `${bare(decodeURIComponent(host))} · Google Search Console` }
}

function RowsTable({ rows, keyLabel }: { rows: SearchRow[]; keyLabel: string }) {
  return (
    <RankedTable
      keyLabel={keyLabel}
      columns={['Clicks', 'Impressions', 'CTR', 'Position']}
      empty="No searches in this period."
      rows={rows.map((row) => ({
        key: row.key,
        bar: row.clicks,
        values: [
          formatNumber(row.clicks),
          formatNumber(row.impressions),
          percent(row.ctr),
          position(row.position),
        ],
      }))}
    />
  )
}

export default async function SearchConsoleSitePage({
  params,
  searchParams,
}: PageProps<'/dashboard/search-console/[host]'>) {
  const user = await requireUser()
  const host = bare(decodeURIComponent((await params).host))
  const range = rangeParam((await searchParams).range)
  const projects = await cachedProjects(user.id)
  const data = await loadSearchConsole(projects, GOOGLE_RANGES[range])
  const found = data ? siteFor(data.sites, host) : undefined

  return (
    <Shell user={user}>
      <nav aria-label="Breadcrumb" className="mb-1 text-sm text-muted">
        <Link href={`/dashboard/search-console?range=${range}`} className="hover:text-ink">
          Google Search Console
        </Link>
      </nav>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{found?.site.host ?? host}</h1>
        {found ? (
          <RangeNav
            range={range}
            href={(id) => `/dashboard/search-console/${found.site.host}?range=${id}`}
          />
        ) : null}
      </div>

      {!data ? (
        <p className="text-sm text-muted">
          Search Console is not set up. Set GOOGLE_SERVICE_ACCOUNT_JSON to a service account key and
          add that account as a user on your Search Console properties.
        </p>
      ) : data.error ? (
        <p className="text-sm text-danger">Could not reach Search Console: {data.error}</p>
      ) : !found ? (
        <p className="text-sm text-muted">
          No Search Console property this service account can read covers {host}. Add the service
          account as a user on the property.
        </p>
      ) : found.error ? (
        <p className="text-sm text-danger">{found.error}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {found.site.projectName}. Google searches from {shortDay(data.window.from)} to{' '}
            {shortDay(data.window.to)}. The latest days are still filling in.
          </p>
          <Overview
            label={found.site.host}
            metric="Clicks"
            stats={[
              { label: 'Clicks', value: formatNumber(found.totals.clicks) },
              { label: 'Impressions', value: formatNumber(found.totals.impressions) },
              { label: 'CTR', value: percent(found.totals.ctr) },
              { label: 'Avg. position', value: position(found.totals.position) },
            ]}
            daily={found.daily.map((d) => ({ day: d.day, value: d.clicks }))}
          />
          <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
            <div className="min-w-0 overflow-x-auto">
              <h2 className="mb-2 text-sm font-medium">Top queries</h2>
              <RowsTable rows={found.queries} keyLabel="Query" />
            </div>
            <div className="min-w-0 overflow-x-auto">
              <h2 className="mb-2 text-sm font-medium">Top pages</h2>
              <RowsTable
                rows={found.pages.map((p) => ({
                  ...p,
                  key: p.key.replace(/^https?:\/\/[^/]+/, '') || '/',
                }))}
                keyLabel="Page"
              />
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
