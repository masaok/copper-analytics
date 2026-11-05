import type { ReactNode } from 'react'
import { Shell } from '@/components/shell'
import { SettingsTabs } from '@/features/settings/settings-tabs'
import { requireUser } from '@/lib/auth'

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  return (
    <Shell user={user}>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Settings</h1>
      <SettingsTabs />
      {children}
    </Shell>
  )
}
