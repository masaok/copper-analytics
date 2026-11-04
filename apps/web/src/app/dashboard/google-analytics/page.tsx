import { formatNumber, Sparkline, TimeSeriesChart } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { type AnalyticsRow, loadAnalytics } from '@/features/analytics/data'
import { GOOGLE_RANGES, sumByDay, weightedMean } from '@/features/google/ranges'
import {
  Overview,
  one,
  percent,
  RangeNav,
  RankedTable,
  rangeParam,
  shortDay,
} from '@/features/google/ui'
import { cachedProjects } from '@/features/projects/queries'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Google Analytics' }

/** 125 seconds as `2m 5s`. */
const duration = (seconds: number) => {
  const s = Math.round(seconds)
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`
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

export default async function GoogleAnalyticsPage({
  searchParams,
}: PageProps<'/dashboard/google-analytics'>) {
  const user = await requireUser()
  const search = await searchParams
  const range = rangeParam(search.range)
  const projects = await cachedProjects(user.id)
  const data = await loadAnalytics(projects, GOOGLE_RANGES[range])
  const reports = [...(data?.properties ?? [])].sort((a, b) => b.totals.users - a.totals.users)
  const selected = reports.find((r) => r.property.host === one(search.site)) ?? reports[0]
  const ok = reports.filter((r) => !r.error)
  const sum = (pick: (t: (typeof ok)[number]['totals']) => number) =>
    ok.reduce((n, r) => n + pick(r.totals), 0)
  const sessions = sum((t) => t.sessions)
  const bySessions = (pick: (t: (typeof ok)[number]['totals']) => number) =>
    weightedMean(
      ok.map((r) => pick(r.totals)),
      ok.map((r) => r.totals.sessions),
    )
  const href = (params: { range?: string; site?: string }) => {
    const query = new URLSearchParams({
      range,
      ...(selected ? { site: selected.property.host } : {}),
    })
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
    return `/dashboard/google-analytics?${query}`
  }

  return (
    <Shell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Google Analytics</h1>
        {data && reports.length > 0 ? (
          <RangeNav range={range} href={(id) => href({ range: id })} />
        ) : null}
      </div>

      {!data ? (
        <p className="text-sm text-muted">
          Google Analytics is not set up. Set GOOGLE_SERVICE_ACCOUNT_JSON to a service account key
          and give that account the Viewer role on your Analytics account or properties.
        </p>
      ) : data.error ? (
        <p className="text-sm text-danger">Could not reach Google Analytics: {data.error}</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted">
          None of your project domains has a Google Analytics web stream this service account can
          read.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Google Analytics from {shortDay(data.window.from)} to {shortDay(data.window.to)}.
          </p>
          <Overview
            metric="Users"
            stats={[
              { label: 'Users', value: formatNumber(sum((t) => t.users)) },
              { label: 'Sessions', value: formatNumber(sessions) },
              { label: 'Views', value: formatNumber(sum((t) => t.views)) },
              { label: 'Engaged', value: percent(bySessions((t) => t.engagementRate)) },
              { label: 'Avg. session', value: duration(bySessions((t) => t.sessionDuration)) },
            ]}
            daily={sumByDay(ok.map((r) => r.daily.map((d) => ({ day: d.day, value: d.users }))))}
          />
          <div className="mb-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm" data-testid="analytics-properties">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 font-normal">Domain</th>
                  <th className="pb-2 font-normal">Project</th>
                  <th className="pb-2 text-right font-normal">Users</th>
                  <th className="pb-2 text-right font-normal">Sessions</th>
                  <th className="pb-2 text-right font-normal">Views</th>
                  <th className="pb-2 text-right font-normal">Engaged</th>
                  <th className="pb-2 text-right font-normal">Avg. session</th>
                  <th className="pb-2 pl-4 font-normal">Daily users</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(({ property, totals, daily, error }) => (
                  <tr
                    key={property.host}
                    className={`border-t border-line ${property === selected?.property ? 'bg-surface' : ''}`}
                  >
                    <td className="py-1.5 pr-4 pl-1">
                      <Link
                        href={href({ site: property.host })}
                        className="font-medium hover:underline"
                        aria-current={property === selected?.property ? 'true' : undefined}
                      >
                        {property.host}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-4 text-muted">{property.projectName}</td>
                    {error ? (
                      <td colSpan={6} className="py-1.5 text-danger">
                        {error}
                      </td>
                    ) : (
                      <>
                        <td className="tabular py-1.5 text-right font-medium">
                          {formatNumber(totals.users)}
                        </td>
                        <td className="tabular py-1.5 text-right">
                          {formatNumber(totals.sessions)}
                        </td>
                        <td className="tabular py-1.5 text-right">{formatNumber(totals.views)}</td>
                        <td className="tabular py-1.5 text-right">
                          {percent(totals.engagementRate)}
                        </td>
                        <td className="tabular py-1.5 text-right">
                          {duration(totals.sessionDuration)}
                        </td>
                        <td className="py-1 pl-4">
                          <Sparkline
                            values={daily.map((d) => d.users)}
                            label={`Daily users from Google Analytics for ${property.host}`}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && !selected.error ? (
            <section aria-labelledby="property-heading">
              <h2 id="property-heading" className="mb-2 text-base font-semibold tracking-tight">
                {selected.property.host}
              </h2>
              <TimeSeriesChart
                metric="Users"
                points={selected.daily.map((d) => ({
                  label: shortDay(d.day),
                  title: shortDay(d.day),
                  value: d.users,
                }))}
              />
              <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
                <div className="min-w-0 overflow-x-auto">
                  <h3 className="mb-2 text-sm font-medium">Top pages</h3>
                  <Rows rows={selected.pages} keyLabel="Page" valueLabel="Views" />
                </div>
                <div className="min-w-0 overflow-x-auto">
                  <h3 className="mb-2 text-sm font-medium">Top sources</h3>
                  <Rows rows={selected.sources} keyLabel="Source / medium" valueLabel="Sessions" />
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </Shell>
  )
}
