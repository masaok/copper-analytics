'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const item = (active: boolean) =>
  `flex h-7 items-center rounded-md px-2.5 text-sm ${
    active ? 'bg-bg font-medium text-ink shadow-sm' : 'text-muted hover:bg-bg/60 hover:text-ink'
  }`

/** The pages around the signed-in user's projects. Projects are listed on /dashboard. */
export function SidebarNav({ className = '' }: { className?: string }) {
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
      <Link href="/new" className={item(path === '/new')}>
        + Add a project
      </Link>
      <div className="my-2 border-t border-line" />
      <Link href="/docs" className={item(path === '/docs')}>
        Docs
      </Link>
    </nav>
  )
}
