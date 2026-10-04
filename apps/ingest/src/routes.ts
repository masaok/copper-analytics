/** Every path the Worker serves. `pnpm check:features` requires a feature-map row for each. */
export const ROUTES = {
  event: '/e',
  live: '/live',
  today: '/today',
  overview: '/overview',
  invalidate: '/invalidate',
  flush: '/flush',
  health: '/health',
} as const
