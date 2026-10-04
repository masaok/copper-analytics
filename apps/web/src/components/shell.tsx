import Link from 'next/link'
import type { ReactNode } from 'react'
import type { SessionUser } from '@/lib/auth'
import { SignOutButton } from './sign-out'
import { Wordmark } from './ui'

export function Shell({ user, children }: { user?: SessionUser | null; children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5">
          <Link href={user ? '/dashboard' : '/'} aria-label="Copper Analytics home">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/docs" className="text-muted hover:text-ink">
              Docs
            </Link>
            {user ? (
              <>
                <span className="hidden text-muted sm:inline">{user.email}</span>
                <SignOutButton />
              </>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
    </>
  )
}
