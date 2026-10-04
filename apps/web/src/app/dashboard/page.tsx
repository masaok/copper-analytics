import type { Metadata } from 'next'
import Link from 'next/link'
import { Shell } from '@/components/shell'
import { buttonClass } from '@/components/ui'
import { listProjects } from '@/features/projects/queries'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'All projects' }

export default async function Dashboard() {
  const user = await requireUser()
  const projects = await listProjects(user.id)
  return (
    <Shell user={user}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">All projects</h1>
        <Link href="/new" className={buttonClass()}>
          Add a project
        </Link>
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-muted">No projects yet. Add one to get its tracking snippet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {projects.map((p) => (
            <li key={p.siteKey} className="flex items-center justify-between py-3 text-sm">
              <Link href={`/p/${p.siteKey}/settings`} className="font-medium hover:underline">
                {p.name}
              </Link>
              <span className="text-muted">{p.domains.join(', ') || 'any domain'}</span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}
