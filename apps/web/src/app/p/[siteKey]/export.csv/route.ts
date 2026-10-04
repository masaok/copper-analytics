import { bounceRate } from '@copper/core'
import { dailyRowsFor } from '@copper/db'
import { cachedProject } from '@/features/projects/queries'
import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'

/** Every stored day for a project, as CSV. */
export async function GET(_request: Request, { params }: RouteContext<'/p/[siteKey]/export.csv'>) {
  const { siteKey } = await params
  const user = await currentUser()
  const project = await cachedProject(siteKey)
  if (!user || !project || project.ownerId !== user.id)
    return new Response('Not found', { status: 404 })
  const rows = await dailyRowsFor(db(), project.id)
  const lines = [
    'day,visitors,pageviews,visits,bounce_rate_percent',
    ...rows.map((r) =>
      [r.bucket, r.visitors, r.pageviews, r.visits, bounceRate(r.bounces, r.visits)].join(','),
    ),
  ]
  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="copper-${siteKey}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
