import type { Metadata } from 'next'
import { countProjects } from '@/features/projects/queries'
import { signInMethods } from '@/features/settings/data'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Settings' }

export default async function AccountSettings() {
  const user = await requireUser()
  const [projects, methods] = await Promise.all([countProjects(user.id), signInMethods(user.id)])
  const rows = [
    { label: 'Name', value: user.name },
    { label: 'Email', value: user.email },
    { label: 'Signs in with', value: methods.join(', ') || '—' },
    { label: 'Projects', value: `${projects} of ${user.projectLimit}` },
  ]
  return (
    <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted">{row.label}</dt>
          <dd className="font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
