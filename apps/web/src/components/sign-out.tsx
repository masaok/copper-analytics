'use client'

import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function SignOutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="cursor-pointer text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      onClick={async () => {
        await authClient.signOut()
        router.push('/')
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
