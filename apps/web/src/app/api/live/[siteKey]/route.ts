import { cachedProject } from '@/features/projects/queries'
import { currentUser } from '@/lib/auth'
import { liveSource } from '@/lib/buffer'

/** Live visitor count for the report header. Open for shared projects, owner-only otherwise. */
export async function GET(_request: Request, { params }: RouteContext<'/api/live/[siteKey]'>) {
  const { siteKey } = await params
  const project = await cachedProject(siteKey)
  if (!project) return new Response('Not found', { status: 404 })
  if (!project.isPublic && (await currentUser())?.id !== project.ownerId) {
    return new Response('Not found', { status: 404 })
  }
  return Response.json(
    { live: await liveSource().live(siteKey) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
