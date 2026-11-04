import Link from 'next/link'
import type { ReactNode } from 'react'
import { cachedProjects } from '@/features/projects/queries'
import type { SessionUser } from '@/lib/auth'
import { SidebarNav } from './sidebar-nav'
import { SignOutButton } from './sign-out'
import { Wordmark } from './ui'

/**
 * Signed in: a full-height sidebar beside the page, each scrolling on its own.
 * Signed out (shared reports, docs): a plain top bar.
 */
export async function Shell({
  user,
  children,
}: {
  user?: SessionUser | null
  children: ReactNode
}) {
  if (!user) {
    return (
      <>
        <header className="border-b border-line">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
            <Link href="/" aria-label="Copper Analytics home">
              <Wordmark />
            </Link>
            <Link href="/docs" className="text-sm text-muted hover:text-ink">
              Docs
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
      </>
    )
  }

  const projects = await cachedProjects(user.id)
  return (
    <div className="flex flex-col md:h-dvh md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col border-line bg-surface max-md:border-b md:w-64 md:border-r">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" aria-label="Copper Analytics home">
            <Wordmark />
          </Link>
          <span className="md:hidden">
            <SignOutButton />
          </span>
        </div>
        <SidebarNav
          projects={projects.map(({ siteKey, name }) => ({ siteKey, name }))}
          className="max-md:hidden md:min-h-0 md:flex-1 md:overflow-y-auto"
        />
        <div className="flex items-center gap-3 border-t border-line px-4 py-3 max-md:hidden">
          {user.image ? (
            // biome-ignore lint/performance/noImgElement: a remote avatar, not worth an image loader
            <img src={user.image} alt="" className="size-7 shrink-0 rounded-full" />
          ) : null}
          <div className="min-w-0 flex-1 text-sm">
            <div className="truncate font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 md:overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">{children}</div>
      </main>
    </div>
  )
}
