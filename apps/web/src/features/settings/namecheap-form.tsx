'use client'

import { useActionState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import type { NamecheapFormState } from './actions'

export function NamecheapForm({
  action,
  apiUser,
  stored,
}: {
  action: (prev: NamecheapFormState, form: FormData) => Promise<NamecheapFormState>
  apiUser?: string
  /** A key is already stored, so the button replaces it. */
  stored: boolean
}) {
  const [state, formAction, pending] = useActionState(action, {})
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <Field htmlFor="nc-user" label="Username" hint="The Namecheap account the key belongs to.">
        <input
          id="nc-user"
          name="apiUser"
          required
          maxLength={64}
          autoComplete="off"
          defaultValue={state.apiUser ?? apiUser ?? ''}
          className={inputClass}
        />
      </Field>
      <Field
        htmlFor="nc-key"
        label="API key"
        hint="Namecheap: Profile, Tools, Business & Dev Tools, API Access. Stored encrypted; only its first and last four characters are shown."
      >
        <input
          id="nc-key"
          name="apiKey"
          type="password"
          required
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
      </Field>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : stored ? 'Replace key' : 'Save key'}
        </Button>
      </div>
    </form>
  )
}
