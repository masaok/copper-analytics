import type { Metadata } from 'next'
import { buttonClass } from '@/components/ui'
import { deleteNamecheap, saveNamecheap } from '@/features/settings/actions'
import { namecheapDomains, namecheapSummary } from '@/features/settings/data'
import { outboundIp } from '@/features/settings/namecheap'
import { NamecheapForm } from '@/features/settings/namecheap-form'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Namecheap API' }

export default async function NamecheapSettings() {
  const user = await requireUser()
  const [stored, clientIp] = await Promise.all([namecheapSummary(user.id), outboundIp()])
  const list = stored ? await namecheapDomains(user.id, clientIp) : null

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p className="max-w-xl text-sm text-muted">
          Lists the domains in your Namecheap account. Turn on API access in Namecheap, then add
          this server's IP address to its allowlist
          {clientIp ? (
            <>
              : <code className="font-mono text-ink">{clientIp}</code>
            </>
          ) : null}
          .
        </p>
        {stored ? (
          <div className="flex items-center gap-3 text-sm">
            <span>
              Stored key for <span className="font-medium">{stored.apiUser}</span>:{' '}
              <code className="font-mono" data-testid="namecheap-masked-key">
                {stored.masked}
              </code>
            </span>
            <form action={deleteNamecheap}>
              <button type="submit" className={buttonClass('danger')}>
                Remove
              </button>
            </form>
          </div>
        ) : null}
        <NamecheapForm action={saveNamecheap} apiUser={stored?.apiUser} stored={Boolean(stored)} />
      </section>

      {list ? (
        <section>
          <h2 className="mb-2 text-base font-semibold tracking-tight">Domains</h2>
          {list.ok ? (
            list.domains.length === 0 ? (
              <p className="text-sm text-muted">No domains in this Namecheap account.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm" data-testid="namecheap-domains">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="pb-2 font-normal">Domain</th>
                      <th className="pb-2 font-normal">Expires</th>
                      <th className="pb-2 font-normal">Auto-renew</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.domains.map((d) => (
                      <tr key={d.name} className="border-t border-line">
                        <td className="py-1.5 pr-4 font-medium">{d.name}</td>
                        <td className={`tabular py-1.5 pr-4 ${d.isExpired ? 'text-danger' : ''}`}>
                          {d.expires}
                          {d.isExpired ? ' (expired)' : ''}
                        </td>
                        <td className="py-1.5 text-muted">{d.autoRenew ? 'On' : 'Off'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <p role="alert" className="text-sm text-danger">
              {list.error}
            </p>
          )}
        </section>
      ) : null}
    </div>
  )
}
