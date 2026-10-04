import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Shell } from '@/components/shell'
import { cachedProject } from '@/features/projects/queries'
import { loadReport } from '@/features/stats/data'
import { reportParams } from '@/features/stats/params'
import { ProjectReport } from '@/features/stats/report'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Project' }

export default async function ProjectPage({ params, searchParams }: PageProps<'/p/[siteKey]'>) {
  const user = await requireUser()
  const { siteKey } = await params
  const project = await cachedProject(siteKey)
  if (!project || project.ownerId !== user.id) notFound()
  const { range, metric, custom } = reportParams(await searchParams)
  const report = await loadReport(project, range, custom)
  return (
    <Shell user={user}>
      <p className="mb-4 flex gap-4 text-sm text-muted">
        <Link href="/dashboard" className="hover:underline">
          All projects
        </Link>
        <Link href={`/p/${siteKey}/settings`} className="hover:underline">
          Settings
        </Link>
      </p>
      <ProjectReport project={project} report={report} metric={metric} basePath={`/p/${siteKey}`} />
    </Shell>
  )
}
