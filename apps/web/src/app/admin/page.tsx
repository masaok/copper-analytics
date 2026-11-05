import { formatNumber } from '@copper/ui'
import type { Metadata } from 'next'
import { Shell } from '@/components/shell'
import { loadAdminTotals, loadAdminUsers } from '@/features/admin/data'
import { requireAdmin } from '@/lib/auth'

export const metadata: Metadata = { title: 'Admin', robots: { index: false } }

const day = (date: Date) => date.toISOString().slice(0, 10)

export default async function Admin() {
  const user = await requireAdmin()
  const [totals, users] = await Promise.all([loadAdminTotals(), loadAdminUsers()])
  const stats = [
    { label: 'Users', value: totals.users },
    { label: 'New users, 30 days', value: totals.newUsers },
    { label: 'Projects', value: totals.projects },
    { label: 'Projects switched off', value: totals.disabledProjects },
    { label: 'Pageviews yesterday', value: totals.pageviewsYesterday },
    { label: 'Pageviews, 30 days', value: totals.pageviews30d },
  ]

  return (
    <Shell user={user}>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Admin</h1>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-line py-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="tabular text-xl font-semibold tracking-tight">
              {formatNumber(s.value)}
            </dd>
          </div>
        ))}
      </dl>

      <h2 className="mb-2 text-base font-semibold tracking-tight">Users</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" data-testid="admin-users">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 font-normal">Name</th>
              <th className="pb-2 font-normal">Email</th>
              <th className="pb-2 font-normal">Signs in with</th>
              <th className="pb-2 text-right font-normal">Projects</th>
              <th className="pb-2 pl-4 font-normal">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="py-1.5 pr-4 font-medium">{u.name}</td>
                <td className="py-1.5 pr-4">
                  {u.email}
                  {u.emailVerified ? null : <span className="ml-1.5 text-muted">(unverified)</span>}
                </td>
                <td className="py-1.5 pr-4 text-muted">{u.providers.join(', ') || '—'}</td>
                <td className="tabular py-1.5 text-right">
                  {u.projects} <span className="text-muted">/ {u.projectLimit}</span>
                </td>
                <td className="tabular py-1.5 pl-4 text-muted">{day(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  )
}
