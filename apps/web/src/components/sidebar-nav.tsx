'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const item = (active: boolean) =>
  `flex h-7 items-center rounded-md px-2.5 text-sm ${
    active ? 'bg-bg font-medium text-ink shadow-sm' : 'text-muted hover:bg-bg/60 hover:text-ink'
  }`

/** The pages around the signed-in user's projects. Projects are listed on /dashboard. */
export function SidebarNav({
  className = '',
  google = false,
}: {
  className?: string
  /** Shows the Google Search Console and Analytics pages, which need a service account. */
  google?: boolean
}) {
  const path = usePathname()
  const inProjects = path === '/dashboard' || path.startsWith('/p/')
  return (
    <nav aria-label="Dashboard" className={`flex flex-col gap-0.5 px-2 pb-3 ${className}`}>
      <Link
        href="/dashboard"
        className={item(inProjects)}
        aria-current={inProjects ? 'page' : undefined}
      >
        All projects
      </Link>
      {google
        ? (
            [
              ['/dashboard/search-console', 'Google Search Console'],
              ['/dashboard/google-analytics', 'Google Analytics'],
            ] as const
          ).map(([href, label]) => {
            // A site's own page, `/dashboard/search-console/example.com`, stays under its item.
            const active = path === href || path.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={item(active)}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            )
          })
        : null}
      <div className="my-2 border-t border-line" />
      <Link
        href="/dashboard/docs"
        className={item(path === '/dashboard/docs')}
        aria-current={path === '/dashboard/docs' ? 'page' : undefined}
      >
        Docs
      </Link>
    </nav>
  )
}
