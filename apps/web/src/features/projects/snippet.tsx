'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'

export function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <pre className="overflow-x-auto rounded-md border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed">
        <code data-testid="snippet">{code}</code>
      </pre>
      <div>
        <Button
          variant="quiet"
          onClick={async () => {
            await navigator.clipboard.writeText(code)
            setCopied(true)
          }}
        >
          {copied ? 'Copied' : 'Copy snippet'}
        </Button>
      </div>
    </div>
  )
}
