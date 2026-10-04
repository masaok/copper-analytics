'use client'

import { BreakdownList, type BreakdownRow } from '@copper/ui'
import { useState } from 'react'

const TABS = [
  { id: 'device', label: 'Devices' },
  { id: 'browser', label: 'Browsers' },
  { id: 'os', label: 'Operating systems' },
] as const
type TabId = (typeof TABS)[number]['id']

export function DeviceTabs({ rows }: { rows: Record<TabId, BreakdownRow[]> }) {
  const [tab, setTab] = useState<TabId>('device')
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]
  return (
    <div>
      <div role="tablist" aria-label="Device breakdown" className="mb-3 flex gap-4 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            onClick={() => setTab(t.id)}
            className={`cursor-pointer border-b-2 pb-1 ${
              t.id === tab
                ? 'border-copper font-medium text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <BreakdownList rows={rows[tab]} keyLabel={current.label.replace(/s$/, '')} />
    </div>
  )
}
