import { formatNumber, Sparkline } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Shell } from '@/components/shell'
import { GOOGLE_RANGES, sumByDay, weightedMean } from '@/features/google/ranges'
import { Overview, one, percent, RangeNav, rangeParam, shortDay } from '@/features/google/ui'
import { cachedProjects } from '@/features/projects/queries'
import { loadSearchConsole } from '@/features/search-console/data'
import { position } from '@/features/search-console/sites'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Google Search Console' }

export default async function SearchConsolePage({
  searchParams,
}: PageProps<'/dashboard/search-console'>) {
  const user = await requireUser()
  const search = await searchParams
  const range = rangeParam(search.range)
  // Each site used to open below the table as `?site=`. Old links land on its own page.
  const legacy = one(search.site)
  if (legacy) redirect(`/dashboard/search-console/${encodeURIComponent(legacy)}?range=${range}`)
  const projects = await cachedProjects(user.id)
  const data = await loadSearchConsole(projects, GOOGLE_RANGES[range])
  const sites = [...(data?.sites ?? [])].sort((a, b) => b.totals.clicks - a.totals.clicks)
  const ok = sites.filter((s) => !s.error)
  const clicks = ok.reduce((n, s) => n + s.totals.clicks, 0)
  const impressions = ok.reduce((n, s) => n + s.totals.impressions, 0)

  return (
    <Shell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Google Search Console</h1>
        {data && sites.length > 0 ? (
          <RangeNav range={range} href={(id) => `/dashboard/search-console?range=${id}`} />
        ) : null}
      </div>

      {!data ? (
        <p className="text-sm text-muted">
          Search Console is not set up. Set GOOGLE_SERVICE_ACCOUNT_JSON to a service account key and
          add that account as a user on your Search Console properties.
        </p>
      ) : data.error ? (
        <p className="text-sm text-danger">Could not reach Search Console: {data.error}</p>
      ) : sites.length === 0 ? (
        <p className="text-sm text-muted">
          None of your project domains has a Search Console property this service account can read.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Google searches from {shortDay(data.window.from)} to {shortDay(data.window.to)}. The
            latest days are still filling in.
          </p>
          <Overview
            metric="Clicks"
            stats={[
              { label: 'Sites', value: String(sites.length) },
              { label: 'Clicks', value: formatNumber(clicks) },
              { label: 'Impressions', value: formatNumber(impressions) },
              { label: 'CTR', value: percent(impressions > 0 ? clicks / impressions : 0) },
              {
                label: 'Avg. position',
                value: position(
                  weightedMean(
                    ok.map((s) => s.totals.position),
                    ok.map((s) => s.totals.impressions),
                  ),
                ),
              },
            ]}
            daily={sumByDay(ok.map((s) => s.daily.map((d) => ({ day: d.day, value: d.clicks }))))}
          />
          <div className="mb-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" data-testid="search-sites">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 font-normal">Domain</th>
                  <th className="pb-2 font-normal">Project</th>
                  <th className="pb-2 text-right font-normal">Clicks</th>
                  <th className="pb-2 text-right font-normal">Impressions</th>
                  <th className="pb-2 text-right font-normal">CTR</th>
                  <th className="pb-2 text-right font-normal">Position</th>
                  <th className="pb-2 pl-4 font-normal">Daily clicks</th>
                </tr>
              </thead>
              <tbody>
                {sites.map(({ site, totals, daily, error }) => (
                  <tr key={site.siteUrl} className="border-t border-line">
                    <td className="py-1.5 pr-4 pl-1">
                      <Link
                        href={`/dashboard/search-console/${site.host}?range=${range}`}
                        className="font-medium hover:underline"
                      >
                        {site.host}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-4 text-muted">{site.projectName}</td>
                    {error ? (
                      <td colSpan={5} className="py-1.5 text-danger">
                        {error}
                      </td>
                    ) : (
                      <>
                        <td className="tabular py-1.5 text-right font-medium">
                          {formatNumber(totals.clicks)}
                        </td>
                        <td className="tabular py-1.5 text-right">
                          {formatNumber(totals.impressions)}
                        </td>
                        <td className="tabular py-1.5 text-right">{percent(totals.ctr)}</td>
                        <td className="tabular py-1.5 text-right">{position(totals.position)}</td>
                        <td className="py-1 pl-4">
                          <Sparkline
                            values={daily.map((d) => d.clicks)}
                            label={`Daily clicks from Google for ${site.host}`}
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
