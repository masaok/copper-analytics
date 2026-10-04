'use client'

import { useEffect, useState } from 'react'

/** Visitors in the last five minutes, refreshed every 15 seconds while the tab is visible. */
export function LiveCount({ siteKey, initial }: { siteKey: string; initial: number }) {
  const [live, setLive] = useState(initial)
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      const res = await fetch(`/api/live/${siteKey}`, { cache: 'no-store' }).catch(() => null)
      if (res?.ok) setLive(((await res.json()) as { live: number }).live)
    }
    const timer = setInterval(tick, 15_000)
    return () => clearInterval(timer)
  }, [siteKey])
  return (
    <span className="inline-flex items-center gap-2 text-sm" data-testid="live">
      <span aria-hidden className={`size-2 rounded-full ${live > 0 ? 'bg-patina' : 'bg-line'}`} />
      <span className="tabular font-medium">{live}</span>
      <span className="text-muted">{live === 1 ? 'visitor now' : 'visitors now'}</span>
    </span>
  )
}
