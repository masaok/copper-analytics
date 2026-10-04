import { SITE_KEY_PATTERN } from './hash'
import type { PageEvent, TrackerPayload } from './types'
import { parseUserAgent } from './ua'
import { pathOf, referrerDomain, utmSourceOf } from './url'

const MAX_URL = 2048

/** A pageview that still carries the two inputs the visitor hash needs. They go no further than the buffer. */
export interface Hit extends Omit<PageEvent, 'v'> {
  ip: string
  ua: string
}

/** Parses the tracker's JSON body. Anything malformed is rejected, never repaired. */
export function parsePayload(body: unknown): TrackerPayload | null {
  if (typeof body !== 'object' || body === null) return null
  const { s, u, r, w } = body as Record<string, unknown>
  if (typeof s !== 'string' || !SITE_KEY_PATTERN.test(s)) return null
  if (typeof u !== 'string' || u.length > MAX_URL || !/^https?:\/\//.test(u)) return null
  if (r !== undefined && r !== null && (typeof r !== 'string' || r.length > MAX_URL)) return null
  if (w !== undefined && w !== null && (typeof w !== 'number' || !Number.isFinite(w))) return null
  return { s, u, r: r ?? undefined, w: w ?? undefined }
}

/** Reduces a pageview to what is stored: path, referrer domain, country and coarse device facts. */
export function toHit(
  payload: TrackerPayload,
  request: { userAgent: string; ip: string; country: string; now: number },
): Hit {
  const ua = parseUserAgent(request.userAgent, payload.w)
  return {
    k: payload.s,
    t: request.now,
    p: pathOf(payload.u),
    r: referrerDomain(payload.r, payload.u),
    c: /^[A-Z]{2}$/.test(request.country) && request.country !== 'XX' ? request.country : '',
    d: ua.device,
    b: ua.browser,
    o: ua.os,
    u: utmSourceOf(payload.u),
    ip: request.ip,
    ua: request.userAgent,
  }
}
