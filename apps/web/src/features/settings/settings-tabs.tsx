'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dashboard/settings', label: 'Account' },
  { href: '/dashboard/settings/namecheap', label: 'Namecheap API' },
] as const

export function SettingsTabs() {
  const path = usePathname()
  return (
    <nav aria-label="Settings" className="mb-5 flex gap-4 border-b border-line text-sm">
      {TABS.map((tab) => {
        const active = path === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 pb-2 ${
              active
                ? 'border-copper font-medium text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
