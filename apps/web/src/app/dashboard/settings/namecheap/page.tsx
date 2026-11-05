import { formatNumber } from '@copper/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonClass } from '@/components/ui'
import { deleteNamecheap, saveNamecheap } from '@/features/settings/actions'
import { namecheapDomains, namecheapSummary } from '@/features/settings/data'
import { outboundIp } from '@/features/settings/namecheap'
import { NamecheapForm } from '@/features/settings/namecheap-form'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Namecheap API' }

export default async function NamecheapSettings() {
  const user = await requireUser()
  const [stored, clientIp, list] = await Promise.all([
    namecheapSummary(user.id),
    outboundIp(),
    namecheapDomains(user.id),
  ])

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <p className="max-w-xl text-sm text-muted">
          Lists your Namecheap domains on the Domains page. Turn on API access in Namecheap, then
          add this server's IP address to its allowlist
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
        list.ok ? (
          <p className="text-sm" data-testid="namecheap-status">
            The key works: {formatNumber(list.domains.length)} domains.{' '}
            <Link href="/dashboard/domains" className="underline">
              See them on Domains
            </Link>
          </p>
        ) : (
          <p role="alert" className="text-sm text-danger">
            {list.error}
          </p>
        )
      ) : null}
    </div>
  )
}
