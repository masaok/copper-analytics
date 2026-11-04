'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const item = (active: boolean) =>
  `flex h-8 items-center rounded-md px-2.5 text-sm ${
    active ? 'bg-bg font-medium text-ink shadow-sm' : 'text-muted hover:bg-bg/60 hover:text-ink'
  }`

/** The signed-in user's own projects, plus the pages around them. */
export function SidebarNav({
  projects,
  className = '',
}: {
  projects: { siteKey: string; name: string }[]
  className?: string
}) {
  const path = usePathname()
  const inProject = (siteKey: string) =>
    path === `/p/${siteKey}` || path.startsWith(`/p/${siteKey}/`)
  return (
    <nav aria-label="Dashboard" className={`flex flex-col gap-0.5 px-2 pb-3 ${className}`}>
      <Link href="/dashboard" className={item(path === '/dashboard')}>
        All projects
      </Link>
      <div className="mt-4 mb-1 px-2.5 text-xs font-medium text-muted">Projects</div>
      {projects.map((project) => (
        <Link
          key={project.siteKey}
          href={`/p/${project.siteKey}`}
          className={item(inProject(project.siteKey))}
          aria-current={inProject(project.siteKey) ? 'page' : undefined}
        >
          <span className="truncate">{project.name}</span>
        </Link>
      ))}
      <Link href="/new" className={item(path === '/new')}>
        + Add a project
      </Link>
      <div className="my-3 border-t border-line" />
      <Link href="/docs" className={item(path === '/docs')}>
        Docs
      </Link>
    </nav>
  )
}
