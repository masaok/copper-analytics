import { defaultFilter, handlePageview, PAGEVIEW_CORS } from '@copper/core'
import { ensureFlusher, simpleMode } from '@/lib/buffer'
import { env } from '@/lib/env'

/** Simple-mode ingest. In edge mode pageviews go to the Worker and this route is unused. */
async function handle(request: Request): Promise<Response> {
  if (env().mode === 'edge') return new Response(null, { status: 404, headers: PAGEVIEW_CORS })
  ensureFlusher()
  const { buffer, projects } = simpleMode()
  return handlePageview(request, {
    projects,
    filter: defaultFilter,
    bufferFor: () => buffer,
    ip: (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
    country: (req) =>
      req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry') ?? '',
  })
}

export { handle as POST, handle as OPTIONS }
