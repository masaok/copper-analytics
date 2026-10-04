import { createHash, timingSafeEqual } from 'node:crypto'
import { bounceRate, isRangeId, SITE_KEY_PATTERN } from '@copper/core'
import { cachedProject, cachedTokenHash } from '@/features/projects/queries'
import { loadReport } from '@/features/stats/data'

const error = (status: number, message: string) => Response.json({ error: message }, { status })

/** Read-only stats for one project. `Authorization: Bearer <token>` with the token from its settings page. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const site = url.searchParams.get('site') ?? ''
  const range = url.searchParams.get('range') ?? '30d'
  if (!SITE_KEY_PATTERN.test(site)) return error(400, 'site must be a 10-character site key.')
  if (!isRangeId(range)) {
    return error(400, 'range must be one of today, 24h, 7d, 30d, 12mo, custom.')
  }

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const expected = await cachedTokenHash(site)
  const given = createHash('sha256').update(token).digest('hex')
  if (!expected || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    // One answer for a wrong token and an unknown site, so keys cannot be probed.
    return error(401, 'Unknown site or wrong token.')
  }
  const project = await cachedProject(site)
  if (!project) return error(401, 'Unknown site or wrong token.')

  const report = await loadReport(project, range, {
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  })
  const shape = (c: { pageviews: number; visitors: number; visits: number; bounces: number }) => ({
    visitors: c.visitors,
    pageviews: c.pageviews,
    visits: c.visits,
    bounce_rate: bounceRate(c.bounces, c.visits),
  })
  return Response.json(
    {
      site,
      range: { id: report.range.id, grain: report.range.grain, ...report.range.current },
      timezone: project.timezone,
      live: report.live,
      totals: shape(report.totals),
      previous: shape(report.previous),
      series: report.series.map((p) => ({ bucket: p.bucket, ...shape(p) })),
    },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  )
}
