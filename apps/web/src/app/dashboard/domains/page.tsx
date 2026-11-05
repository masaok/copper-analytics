import { formatNumber } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { cachedProjects } from '@/features/projects/queries'
import { namecheapDomains } from '@/features/settings/data'
import { domainRows, type Expiry } from '@/features/settings/namecheap'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Domains' }

const EXPIRY: Record<Expiry, { className: string; note: string }> = {
  expired: { className: 'text-danger', note: ' (expired)' },
  soon: { className: 'text-copper', note: ' (within 30 days)' },
  ok: { className: '', note: '' },
}

const sortLink = (active: boolean) =>
  active ? 'text-ink underline underline-offset-4' : 'hover:text-ink'

export default async function Domains({ searchParams }: PageProps<'/dashboard/domains'>) {
  const user = await requireUser()
  const byExpiry = (await searchParams).sort === 'expires'
  const [list, projects] = await Promise.all([namecheapDomains(user.id), cachedProjects(user.id)])
  const rows = list?.ok ? domainRows(list.domains, projects) : []
  if (byExpiry) rows.sort((a, b) => a.expires.localeCompare(b.expires))
  const expiring = rows.filter((r) => r.expiry !== 'ok').length

  return (
    <Shell user={user}>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Domains</h1>

      {!list ? (
        <p className="max-w-xl text-sm text-muted">
          Lists the domains in your Namecheap account.{' '}
          <Link href="/dashboard/settings/namecheap" className="text-ink underline">
            Add a Namecheap API key
          </Link>{' '}
          to see them here.
        </p>
      ) : !list.ok ? (
        <p role="alert" className="text-sm text-danger">
          {list.error}{' '}
          <Link href="/dashboard/settings/namecheap" className="underline">
            Namecheap API settings
          </Link>
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No domains in this Namecheap account.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {formatNumber(rows.length)} domains in Namecheap
            {expiring > 0 ? `, ${formatNumber(expiring)} expired or expiring within 30 days` : ''}.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm" data-testid="domains">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 font-normal">
                    <Link href="/dashboard/domains" className={sortLink(!byExpiry)}>
                      Domain
                    </Link>
                  </th>
                  <th className="pb-2 font-normal">Copper project</th>
                  <th className="pb-2 font-normal">
                    <Link href="/dashboard/domains?sort=expires" className={sortLink(byExpiry)}>
                      Expires
                    </Link>
                  </th>
                  <th className="pb-2 font-normal">Auto-renew</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.name} className="border-t border-line">
                    <td className="py-1.5 pr-4 font-medium">{row.name}</td>
                    <td className="py-1.5 pr-4">
                      {row.projects.map((p, i) => (
                        <span key={p.siteKey}>
                          {i > 0 ? ', ' : ''}
                          <Link href={`/p/${p.siteKey}`} className="hover:underline">
                            {p.name}
                          </Link>
                        </span>
                      ))}
                    </td>
                    <td className={`tabular py-1.5 pr-4 ${EXPIRY[row.expiry].className}`}>
                      {row.expires}
                      {EXPIRY[row.expiry].note}
                    </td>
                    <td className="py-1.5 text-muted">{row.autoRenew ? 'On' : 'Off'}</td>
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
