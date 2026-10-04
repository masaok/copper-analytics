'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui'
import type { TokenState } from './actions'

export function ApiToken({
  action,
  hasToken,
  example,
}: {
  action: (prev: TokenState) => Promise<TokenState>
  hasToken: boolean
  example: string
}) {
  const [state, rotate, pending] = useActionState(action, {})
  return (
    <form action={rotate} className="flex flex-col gap-3">
      {state.token ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">Copy this token now. It is not shown again.</p>
          <pre className="overflow-x-auto rounded-md border border-line bg-surface p-3 font-mono text-[13px]">
            <code data-testid="api-token">{state.token}</code>
          </pre>
        </div>
      ) : null}
      <pre className="overflow-x-auto rounded-md border border-line bg-surface p-3 font-mono text-[13px] leading-relaxed">
        <code>{example}</code>
      </pre>
      <div>
        <Button variant="quiet" type="submit" disabled={pending}>
          {hasToken || state.token ? 'Replace the token' : 'Create a token'}
        </Button>
      </div>
    </form>
  )
}
