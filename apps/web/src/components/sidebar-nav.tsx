'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const item = (active: boolean) =>
  `flex h-7 items-center rounded-md px-2.5 text-sm ${
    active ? 'bg-bg font-medium text-ink shadow-sm' : 'text-muted hover:bg-bg/60 hover:text-ink'
  }`

const button = (color: string) =>
  `flex h-8 items-center justify-center rounded-md text-sm font-medium text-bg hover:opacity-90 ${color}`

/** A sidebar link that marks itself current on its page and, when `nested`, on the pages below it. */
function NavLink({
  href,
  label,
  path,
  nested = false,
}: {
  href: string
  label: string
  path: string
  nested?: boolean
}) {
  const active = path === href || (nested && path.startsWith(`${href}/`))
  return (
    <Link href={href} className={item(active)} aria-current={active ? 'page' : undefined}>
      {label}
    </Link>
  )
}

/** The pages around the signed-in user's projects. Projects are listed on /dashboard. */
export function SidebarNav({
  className = '',
  google = false,
  admin = false,
}: {
  className?: string
  /** Shows the Google Search Console and Analytics pages, which need a service account. */
  google?: boolean
  /** Shows the red Admin button at the bottom. */
  admin?: boolean
}) {
  const path = usePathname()

  if (path === '/admin' || path.startsWith('/admin/')) {
    return (
      <nav aria-label="Admin" className={`flex flex-col gap-0.5 px-2 pb-3 ${className}`}>
        <NavLink href="/admin" label="Users" path={path} />
        <Link href="/dashboard" className={`mt-auto ${button('bg-patina')}`}>
          Back to dashboard
        </Link>
      </nav>
    )
  }

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
      {/* A site's own page, `/dashboard/search-console/example.com`, stays under its item. */}
      {google ? (
        <>
          <NavLink
            href="/dashboard/search-console"
            label="Google Search Console"
            path={path}
            nested
          />
          <NavLink href="/dashboard/google-analytics" label="Google Analytics" path={path} nested />
        </>
      ) : null}
      <NavLink href="/dashboard/domains" label="Domains" path={path} />
      <div className="my-2 border-t border-line" />
      <NavLink href="/dashboard/settings" label="Settings" path={path} nested />
      <NavLink href="/dashboard/docs" label="Docs" path={path} />
      {admin ? (
        <Link href="/admin" className={`mt-auto ${button('bg-danger')}`}>
          Admin
        </Link>
      ) : null}
    </nav>
  )
}
