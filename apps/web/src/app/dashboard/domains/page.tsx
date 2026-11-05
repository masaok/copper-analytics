import { formatNumber } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { googleSetup } from '@/features/google/setup'
import { cachedProjects } from '@/features/projects/queries'
import { domainRepositories, googleSetupLists, namecheapDomains } from '@/features/settings/data'
import { domainRows, type Expiry } from '@/features/settings/namecheap'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Domains' }

const EXPIRY: Record<Expiry, { className: string; note: string }> = {
  expired: { className: 'text-danger', note: ' (expired)' },
  soon: { className: 'text-copper', note: ' (within 30 days)' },
  ok: { className: '', note: '' },
}

const UNKNOWN = { analytics: null, searchConsole: null }

const sortLink = (active: boolean) =>
  active ? 'text-ink underline underline-offset-4' : 'hover:text-ink'

export default async function Domains({ searchParams }: PageProps<'/dashboard/domains'>) {
  const user = await requireUser()
  const byExpiry = (await searchParams).sort === 'expires'
  const [list, projects, repositories, google] = await Promise.all([
    namecheapDomains(user.id),
    cachedProjects(user.id),
    domainRepositories(user.id),
    googleSetupLists(),
  ])
  const rows = list?.ok ? domainRows(list.domains, projects, repositories) : []
  if (byExpiry) rows.sort((a, b) => a.expires.localeCompare(b.expires))
  const expiring = rows.filter((r) => r.expiry !== 'ok').length
  const showGoogle = google.kind !== 'off'

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
          {google.kind === 'off' ? (
            <p className="mb-3 text-sm text-muted">
              Google Analytics and Search Console are not set up. Set GOOGLE_SERVICE_ACCOUNT_JSON to
              a service account key, give that account the Viewer role on your Analytics account or
              properties, and add it as a user on your Search Console properties.
            </p>
          ) : google.kind === 'error' ? (
            <p role="alert" className="mb-3 text-sm text-danger">
              Could not reach Google: {google.error}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm" data-testid="domains">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-2 font-normal">
                    <Link href="/dashboard/domains" className={sortLink(!byExpiry)}>
                      Domain
                    </Link>
                  </th>
                  <th className="pb-2 font-normal">Repository</th>
                  <th className="pb-2 font-normal">
                    <Link href="/dashboard/domains?sort=expires" className={sortLink(byExpiry)}>
                      Expires
                    </Link>
                  </th>
                  <th className="pb-2 font-normal">Auto-renew</th>
                  {showGoogle ? (
                    <>
                      <th className="pb-2 font-normal">Google Analytics</th>
                      <th className="pb-2 font-normal">Search Console</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const setup = google.kind === 'ok' ? googleSetup(row.name, google) : UNKNOWN
                  return (
                    <tr key={row.name} className="border-t border-line">
                      <td className="py-1.5 pr-4 font-medium">{row.name}</td>
                      <td className="py-1.5 pr-4">
                        {row.repository ? (
                          <a
                            href={`https://github.com/${row.repository}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {row.repository}
                          </a>
                        ) : null}
                        {row.projects.map((p, i) => (
                          <span key={p.siteKey} className={row.repository ? 'text-muted' : ''}>
                            {i > 0 || row.repository ? ', ' : ''}
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
                      <td className="py-1.5 pr-4 text-muted">{row.autoRenew ? 'On' : 'Off'}</td>
                      {showGoogle ? (
                        <>
                          <SetupCell value={setup.analytics} />
                          <SetupCell value={setup.searchConsole} />
                        </>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  )
}

/** Yes, a muted No, or a muted ? when Google could not be read. */
function SetupCell({ value }: { value: boolean | null }) {
  if (value === null) return <td className="py-1.5 pr-4 text-muted">?</td>
  return <td className={`py-1.5 pr-4 ${value ? '' : 'text-muted'}`}>{value ? 'Yes' : 'No'}</td>
}
