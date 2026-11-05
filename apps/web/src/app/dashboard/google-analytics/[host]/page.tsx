import { formatNumber } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { type AnalyticsRow, loadAnalytics } from '@/features/analytics/data'
import { bare, GOOGLE_RANGES } from '@/features/google/ranges'
import {
  duration,
  Overview,
  percent,
  RangeNav,
  RankedTable,
  rangeParam,
  shortDay,
} from '@/features/google/ui'
import { cachedProjects } from '@/features/projects/queries'
import { requireUser } from '@/lib/auth'

export async function generateMetadata({
  params,
}: PageProps<'/dashboard/google-analytics/[host]'>): Promise<Metadata> {
  const { host } = await params
  return { title: `${bare(decodeURIComponent(host))} · Google Analytics` }
}

function Rows({
  rows,
  keyLabel,
  valueLabel,
}: {
  rows: AnalyticsRow[]
  keyLabel: string
  valueLabel: string
}) {
  return (
    <RankedTable
      keyLabel={keyLabel}
      columns={[valueLabel, 'Users']}
      empty="Nothing recorded in this period."
      rows={rows.map((row) => ({
        key: row.key,
        bar: row.value,
        values: [formatNumber(row.value), formatNumber(row.users)],
      }))}
    />
  )
}

export default async function GoogleAnalyticsPropertyPage({
  params,
  searchParams,
}: PageProps<'/dashboard/google-analytics/[host]'>) {
  const user = await requireUser()
  const host = bare(decodeURIComponent((await params).host))
  const range = rangeParam((await searchParams).range)
  const projects = await cachedProjects(user.id)
  const data = await loadAnalytics(projects, GOOGLE_RANGES[range])
  const found = data?.properties.find((r) => r.property.host === host)

  return (
    <Shell user={user}>
      <nav aria-label="Breadcrumb" className="mb-1 text-sm text-muted">
        <Link href={`/dashboard/google-analytics?range=${range}`} className="hover:text-ink">
          Google Analytics
        </Link>
      </nav>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{host}</h1>
        {found ? (
          <RangeNav
            range={range}
            href={(id) => `/dashboard/google-analytics/${host}?range=${id}`}
          />
        ) : null}
      </div>

      {!data ? (
        <p className="text-sm text-muted">
          Google Analytics is not set up. Set GOOGLE_SERVICE_ACCOUNT_JSON to a service account key
          and give that account the Viewer role on your Analytics account or properties.
        </p>
      ) : data.error ? (
        <p className="text-sm text-danger">Could not reach Google Analytics: {data.error}</p>
      ) : !found ? (
        <p className="text-sm text-muted">
          No Google Analytics web stream this service account can read is on {host}. Give the
          service account the Viewer role on the property.
        </p>
      ) : found.error ? (
        <p className="text-sm text-danger">{found.error}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {found.property.projectName}. Google Analytics from {shortDay(data.window.from)} to{' '}
            {shortDay(data.window.to)}.
          </p>
          <Overview
            label={host}
            metric="Users"
            stats={[
              { label: 'Users', value: formatNumber(found.totals.users) },
              { label: 'Sessions', value: formatNumber(found.totals.sessions) },
              { label: 'Views', value: formatNumber(found.totals.views) },
              { label: 'Engaged', value: percent(found.totals.engagementRate) },
              { label: 'Avg. session', value: duration(found.totals.sessionDuration) },
            ]}
            daily={found.daily.map((d) => ({ day: d.day, value: d.users }))}
          />
          <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
            <div className="min-w-0 overflow-x-auto">
              <h2 className="mb-2 text-sm font-medium">Top pages</h2>
              <Rows rows={found.pages} keyLabel="Page" valueLabel="Views" />
            </div>
            <div className="min-w-0 overflow-x-auto">
              <h2 className="mb-2 text-sm font-medium">Top sources</h2>
              <Rows rows={found.sources} keyLabel="Source / medium" valueLabel="Sessions" />
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
