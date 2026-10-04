import type { EventBuffer } from './buffer'
import type { ProjectDirectory } from './directory'
import { parsePayload, toHit } from './enrich'
import type { Filter } from './filter'

export interface PageviewDeps {
  projects: ProjectDirectory
  filter: Filter
  /** The buffer that owns this site key: a shard in edge mode, the one in-process buffer otherwise. */
  bufferFor(siteKey: string): EventBuffer
  /** Where the request came from, read from whatever headers the host sets. */
  ip(request: Request): string
  country(request: Request): string
  clock?: () => number
  /** Keeps work running after the response is sent. */
  waitUntil?(work: Promise<unknown>): void
}

export const PAGEVIEW_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}
/** The tracker sends a URL of at most 2,048 characters and a referrer of the same size. */
export const MAX_BODY_BYTES = 8192

const accepted = () => new Response(null, { status: 204, headers: PAGEVIEW_CORS })

/**
 * Handles the tracker's POST in both modes. Every outcome answers 204, so a caller
 * learns nothing about which site keys exist or why a pageview was dropped.
 */
export async function handlePageview(request: Request, deps: PageviewDeps): Promise<Response> {
  if (request.method === 'OPTIONS') return accepted()
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: PAGEVIEW_CORS })
  // A pageview is a few hundred bytes. Refuse anything larger before reading it.
  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) return accepted()
  let body: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_BYTES) return accepted()
    body = JSON.parse(text)
  } catch {
    return accepted()
  }
  const payload = parsePayload(body)
  if (!payload) return accepted()
  const project = await deps.projects.get(payload.s)
  if (!project) return accepted()

  const userAgent = request.headers.get('User-Agent') ?? ''
  const ip = deps.ip(request)
  const reason = deps.filter.reject({
    userAgent,
    origin: request.headers.get('Origin') ?? payload.u,
    ip,
    referrer: payload.r ?? '',
    project,
  })
  if (reason) return accepted()

  const hit = toHit(payload, {
    userAgent,
    ip,
    country: deps.country(request),
    now: (deps.clock ?? Date.now)(),
  })
  const work = deps.bufferFor(hit.k).add(hit, project.dailyCap)
  if (deps.waitUntil) deps.waitUntil(work)
  else await work
  return accepted()
}

/** Compares two secrets without stopping at the first difference, so timing reveals nothing. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i % (b.length || 1))
  return diff === 0
}

/** True when the request carries `Authorization: Bearer <secret>` for a configured secret. */
export function hasBearer(request: Request, secret: string | undefined): boolean {
  if (!secret) return false
  return safeEqual(request.headers.get('Authorization') ?? '', `Bearer ${secret}`)
}
