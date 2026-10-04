import { TRACKER_TEMPLATE } from './generated'

/** Hard limit for the gzipped script. The test suite fails above it. */
export const MAX_GZIP_BYTES = 1500

/**
 * The tracker script. With an endpoint it posts there; without one it posts to
 * `/api/e` on the origin the script was loaded from.
 */
export function trackerScript(endpoint = ''): string {
  return TRACKER_TEMPLATE.replace(/\b\w+\.__COPPER_ENDPOINT__/, JSON.stringify(endpoint))
}
