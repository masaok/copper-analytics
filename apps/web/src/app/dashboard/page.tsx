import { percentChange } from '@copper/core'
import { Delta, formatNumber, Sparkline } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { buttonClass } from '@/components/ui'
import { cachedProjects } from '@/features/projects/queries'
import { loadOverview } from '@/features/stats/data'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'All projects' }

export default async function Dashboard({ searchParams }: PageProps<'/dashboard'>) {
  const user = await requireUser()
  const byName = (await searchParams).sort === 'name'
  const projects = await cachedProjects(user.id)
  const rows = await loadOverview(user.id, projects)
  if (!byName) {
    rows.sort((a, b) => b.todayVisitors - a.todayVisitors || b.pageviews30d - a.pageviews30d)
  }
  const total = (pick: (r: (typeof rows)[number]) => number) =>
    rows.reduce((n, r) => n + pick(r), 0)
  const totals = [
    { label: 'Visitors now', value: total((r) => r.live) },
    { label: 'Visitors today', value: total((r) => r.todayVisitors) },
    { label: 'Pageviews today', value: total((r) => r.todayPageviews) },
    { label: 'Pageviews, 30 days', value: total((r) => r.pageviews30d) },
  ]

  return (
    <Shell user={user}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">All projects</h1>
        <Link href="/new" className={buttonClass()}>
          Add a project
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No projects yet. Add one to get its tracking snippet.</p>
      ) : (
        <>
          <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-5 sm:grid-cols-4">
            {totals.map((t) => (
              <div key={t.label}>
                <dt className="text-sm text-muted">{t.label}</dt>
                <dd className="tabular text-2xl font-semibold tracking-tight">
                  {formatNumber(t.value)}
                </dd>
              </div>
            ))}
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm" data-testid="overview">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 font-normal">
                    <Link
                      href="/dashboard?sort=name"
                      className={
                        byName ? 'text-ink underline underline-offset-4' : 'hover:text-ink'
                      }
                    >
                      Project
                    </Link>
                  </th>
                  <th className="pb-2 text-right font-normal">Now</th>
                  <th className="pb-2 text-right font-normal">
                    <Link
                      href="/dashboard"
                      className={
                        byName ? 'hover:text-ink' : 'text-ink underline underline-offset-4'
                      }
                    >
                      Visitors today
                    </Link>
                  </th>
                  <th className="pb-2 pl-4 font-normal">vs yesterday</th>
                  <th className="pb-2 font-normal">Visitors, 30 days</th>
                  <th className="pb-2 text-right font-normal">Pageviews, 30 days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.project.siteKey} className="border-t border-line">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/p/${row.project.siteKey}`}
                        className="font-medium hover:underline"
                      >
                        {row.project.name}
                      </Link>
                      <div className="text-muted">{row.project.domains[0] ?? 'Any domain'}</div>
                    </td>
                    <td className="tabular py-3 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className={`size-1.5 rounded-full ${row.live > 0 ? 'bg-patina' : 'bg-line'}`}
                        />
                        {row.live}
                      </span>
                    </td>
                    <td className="tabular py-3 text-right font-medium">
                      {formatNumber(row.todayVisitors)}
                    </td>
                    <td className="py-3 pl-4">
                      <Delta value={percentChange(row.todayVisitors, row.yesterdayVisitors)} />
                    </td>
                    <td className="py-2">
                      <Sparkline
                        values={row.trend}
                        label={`Daily visitors over 30 days for ${row.project.name}`}
                      />
                    </td>
                    <td className="tabular py-3 text-right">{formatNumber(row.pageviews30d)}</td>
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
