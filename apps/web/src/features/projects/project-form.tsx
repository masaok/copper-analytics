'use client'

import { useActionState } from 'react'
import { Button, Field, inputClass } from '@/components/ui'
import type { FormState } from './actions'

export interface ProjectFormValues {
  name: string
  domains: string[]
  timezone: string
  isPublic?: boolean
}

export function ProjectForm({
  action,
  values,
  submitLabel,
  showSharing = false,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>
  values?: ProjectFormValues
  submitLabel: string
  showSharing?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const current = state.values ?? {
    name: values?.name ?? '',
    domains: values?.domains.join(', ') ?? '',
    timezone: values?.timezone ?? 'UTC',
    isPublic: values?.isPublic ?? false,
  }
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <Field htmlFor="f-name" label="Name">
        <input
          id="f-name"
          name="name"
          required
          maxLength={60}
          defaultValue={current.name}
          className={inputClass}
          placeholder="Acme shop"
        />
      </Field>
      <Field
        htmlFor="f-domains"
        label="Domains"
        hint="Pageviews are accepted only from these domains and their subdomains. Leave empty to accept any."
      >
        <input
          id="f-domains"
          name="domains"
          defaultValue={current.domains}
          className={inputClass}
          placeholder="acme.io, shop.acme.io"
        />
      </Field>
      <Field
        htmlFor="f-timezone"
        label="Timezone"
        hint="Days start and end at midnight in this timezone."
      >
        <input
          id="f-timezone"
          name="timezone"
          defaultValue={current.timezone}
          className={inputClass}
          placeholder="Europe/Berlin"
        />
      </Field>
      {showSharing ? (
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isPublic"
            defaultChecked={current.isPublic}
            className="mt-0.5 accent-(--copper)"
          />
          <span>
            <span className="font-medium">Share a read-only dashboard</span>
            <span className="block text-muted">
              Anyone with the link can see this project's traffic.
            </span>
          </span>
        </label>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        {state.saved ? <span className="text-sm text-patina">Saved</span> : null}
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
