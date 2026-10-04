'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button, Field, inputClass } from './ui'

const LABELS = { github: 'Sign in with GitHub', google: 'Sign in with Google' } as const
export type Provider = keyof typeof LABELS

export function SignIn({ providers, demo }: { providers: Provider[]; demo: boolean }) {
  const router = useRouter()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      {providers.map((provider, i) => (
        <Button
          key={provider}
          variant={i === 0 ? 'primary' : 'quiet'}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const result = await authClient.signIn.social({ provider, callbackURL: '/dashboard' })
            if (result.error) {
              setError(result.error.message ?? 'Sign-in failed. Try again.')
              setBusy(false)
            }
          }}
        >
          {LABELS[provider]}
        </Button>
      ))}
      {demo ? (
        <form
          className="mt-2 flex flex-col gap-3 border-t border-line pt-5"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            const form = new FormData(event.currentTarget)
            const result = await authClient.signIn.email({
              email: String(form.get('email')),
              password: String(form.get('password')),
            })
            if (result.error) {
              setError('That email and password do not match the demo account.')
              setBusy(false)
              return
            }
            router.push('/dashboard')
            router.refresh()
          }}
        >
          <Field htmlFor="f-email" label="Email">
            <input
              id="f-email"
              name="email"
              type="email"
              required
              className={inputClass}
              defaultValue="demo@copper.local"
            />
          </Field>
          <Field
            htmlFor="f-password"
            label="Password"
            hint="The seed script prints the demo password."
          >
            <input
              id="f-password"
              name="password"
              type="password"
              required
              className={inputClass}
            />
          </Field>
          <Button variant={providers.length ? 'quiet' : 'primary'} disabled={busy} type="submit">
            Sign in to the demo account
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
