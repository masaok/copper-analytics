import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Shell } from '@/components/shell'
import { cachedProject } from '@/features/projects/queries'
import { loadReport } from '@/features/stats/data'
import { reportParams } from '@/features/stats/params'
import { ProjectReport } from '@/features/stats/report'

export const metadata: Metadata = { title: 'Shared dashboard', robots: { index: false } }

/** Read-only report. It exists only while the owner has sharing switched on. */
export default async function SharedPage({ params, searchParams }: PageProps<'/share/[siteKey]'>) {
  const { siteKey } = await params
  const { range, metric, custom } = reportParams(await searchParams)
  const project = await cachedProject(siteKey)
  if (!project?.isPublic) notFound()
  const report = await loadReport(project, range, custom)
  return (
    <Shell>
      <ProjectReport
        project={project}
        report={report}
        metric={metric}
        basePath={`/share/${siteKey}`}
      />
    </Shell>
  )
}
