import Link from 'next/link'
import type { ReactNode } from 'react'
import type { SessionUser } from '@/lib/auth'
import { env } from '@/lib/env'
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
          <div className="flex h-12 w-full items-center justify-between px-4 md:px-6">
            <Link href="/" aria-label="Copper Analytics home">
              <Wordmark />
            </Link>
            <Link href="/docs" className="text-sm text-muted hover:text-ink">
              Docs
            </Link>
          </div>
        </header>
        <main className="w-full flex-1 px-4 py-5 md:px-6">{children}</main>
      </>
    )
  }

  return (
    <div className="flex flex-col md:h-dvh md:flex-row md:overflow-hidden">
      <aside className="flex shrink-0 flex-col border-line bg-surface max-md:border-b md:w-52 md:border-r">
        <div className="flex h-12 items-center justify-between px-4">
          <Link href="/dashboard" aria-label="Copper Analytics home">
            <Wordmark />
          </Link>
          <span className="md:hidden">
            <SignOutButton />
          </span>
        </div>
        <SidebarNav
          className="max-md:hidden md:min-h-0 md:flex-1 md:overflow-y-auto"
          google={Boolean(env().googleServiceAccount)}
          admin={user.admin}
        />
        <div className="flex items-center gap-2.5 border-t border-line px-3 py-2.5 max-md:hidden">
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
        <div className="w-full px-4 py-5 md:px-6">{children}</div>
      </main>
    </div>
  )
}
