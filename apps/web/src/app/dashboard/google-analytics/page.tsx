import { formatNumber, Sparkline } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Shell } from '@/components/shell'
import { loadAnalytics } from '@/features/analytics/data'
import { GOOGLE_RANGES, sumByDay, weightedMean } from '@/features/google/ranges'
import {
  duration,
  Overview,
  one,
  percent,
  RangeNav,
  rangeParam,
  shortDay,
} from '@/features/google/ui'
import { cachedProjects } from '@/features/projects/queries'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Google Analytics' }

export default async function GoogleAnalyticsPage({
  searchParams,
}: PageProps<'/dashboard/google-analytics'>) {
  const user = await requireUser()
  const search = await searchParams
  const range = rangeParam(search.range)
  // Each property used to open below the table as `?site=`. Old links land on its own page.
  const legacy = one(search.site)
  if (legacy) redirect(`/dashboard/google-analytics/${encodeURIComponent(legacy)}?range=${range}`)
  const projects = await cachedProjects(user.id)
  const data = await loadAnalytics(projects, GOOGLE_RANGES[range])
  const reports = [...(data?.properties ?? [])].sort((a, b) => b.totals.users - a.totals.users)
  const ok = reports.filter((r) => !r.error)
  const sum = (pick: (t: (typeof ok)[number]['totals']) => number) =>
    ok.reduce((n, r) => n + pick(r.totals), 0)
  const sessions = sum((t) => t.sessions)
  const bySessions = (pick: (t: (typeof ok)[number]['totals']) => number) =>
    weightedMean(
      ok.map((r) => pick(r.totals)),
      ok.map((r) => r.totals.sessions),
    )

  return (
    <Shell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Google Analytics</h1>
        {data && reports.length > 0 ? (
          <RangeNav range={range} href={(id) => `/dashboard/google-analytics?range=${id}`} />
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
                  <tr key={property.host} className="border-t border-line">
                    <td className="py-1.5 pr-4 pl-1">
                      <Link
                        href={`/dashboard/google-analytics/${property.host}?range=${range}`}
                        className="font-medium hover:underline"
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
        </>
      )}
    </Shell>
  )
}
