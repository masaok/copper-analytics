import { formatNumber, Sparkline, TimeSeriesChart } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { GOOGLE_RANGES } from '@/features/google/ranges'
import { one, percent, RangeNav, RankedTable, rangeParam, shortDay } from '@/features/google/ui'
import { cachedProjects } from '@/features/projects/queries'
import { loadSearchConsole, type SearchRow } from '@/features/search-console/data'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Google Search Console' }

const position = (p: number) => (p > 0 ? p.toFixed(1) : '–')

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

export default async function SearchConsolePage({ searchParams }: PageProps<'/search-console'>) {
  const user = await requireUser()
  const search = await searchParams
  const range = rangeParam(search.range)
  const projects = await cachedProjects(user.id)
  const data = await loadSearchConsole(projects, GOOGLE_RANGES[range])
  const sites = [...(data?.sites ?? [])].sort((a, b) => b.totals.clicks - a.totals.clicks)
  const selected = sites.find((s) => s.site.host === one(search.site)) ?? sites[0]
  const href = (params: { range?: string; site?: string }) => {
    const query = new URLSearchParams({ range, ...(selected ? { site: selected.site.host } : {}) })
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value)
    return `/search-console?${query}`
  }

  return (
    <Shell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Google Search Console</h1>
        {data && sites.length > 0 ? (
          <RangeNav range={range} href={(id) => href({ range: id })} />
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
                  <tr
                    key={site.siteUrl}
                    className={`border-t border-line ${site === selected?.site ? 'bg-surface' : ''}`}
                  >
                    <td className="py-1.5 pr-4 pl-1">
                      <Link
                        href={href({ site: site.host })}
                        className="font-medium hover:underline"
                        aria-current={site === selected?.site ? 'true' : undefined}
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

          {selected && !selected.error ? (
            <section aria-labelledby="site-heading">
              <h2 id="site-heading" className="mb-2 text-base font-semibold tracking-tight">
                {selected.site.host}
              </h2>
              <TimeSeriesChart
                metric="Clicks"
                points={selected.daily.map((d) => ({
                  label: shortDay(d.day),
                  title: shortDay(d.day),
                  value: d.clicks,
                }))}
              />
              <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
                <div className="min-w-0 overflow-x-auto">
                  <h3 className="mb-2 text-sm font-medium">Top queries</h3>
                  <RowsTable rows={selected.queries} keyLabel="Query" />
                </div>
                <div className="min-w-0 overflow-x-auto">
                  <h3 className="mb-2 text-sm font-medium">Top pages</h3>
                  <RowsTable
                    rows={selected.pages.map((p) => ({
                      ...p,
                      key: p.key.replace(/^https?:\/\/[^/]+/, '') || '/',
                    }))}
                    keyLabel="Page"
                  />
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </Shell>
  )
}
