import { trackerScript } from '@copper/tracker'
import { env } from '@/lib/env'

/** The tracker. In edge mode it posts to the ingest Worker; otherwise to /api/e on this origin. */
export function GET() {
  const { mode, ingestUrl } = env()
  return new Response(trackerScript(mode === 'edge' && ingestUrl ? `${ingestUrl}/e` : ''), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
