import type { ProjectConfig } from './types'

/** The part of Workers KV this needs. A Map-backed fake satisfies it in tests. */
export interface ConfigCache {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

const MEMORY_TTL_MS = 5 * 60_000
/** Known projects stay cached for a week; the web app invalidates them when they change. */
const KNOWN_TTL_S = 7 * 86_400
/** Unknown keys are remembered for an hour so junk traffic cannot keep the database awake. */
const UNKNOWN_TTL_S = 3600
const UNKNOWN = '0'
/** Database lookups one isolate may make per memory-TTL window. */
const MAX_LOADS_PER_WINDOW = 30

/**
 * Resolves a site key to its project settings: memory first, then KV, then the database.
 * Negative results are cached at every level.
 */
export class ProjectDirectory {
  private readonly memory = new Map<string, { value: ProjectConfig | null; expires: number }>()
  private windowStart = 0
  private loads = 0

  constructor(
    private readonly load: (siteKey: string) => Promise<ProjectConfig | null>,
    private readonly cache?: ConfigCache,
    private readonly clock: () => number = Date.now,
  ) {}

  async get(siteKey: string): Promise<ProjectConfig | null> {
    const now = this.clock()
    const hit = this.memory.get(siteKey)
    if (hit && hit.expires > now) return hit.value

    let value: ProjectConfig | null | undefined
    const cached = await this.cache?.get(siteKey).catch(() => null)
    if (cached === UNKNOWN) value = null
    else if (cached) value = JSON.parse(cached) as ProjectConfig

    if (value === undefined) {
      if (now - this.windowStart > MEMORY_TTL_MS) {
        this.windowStart = now
        this.loads = 0
      }
      // Past the budget, treat the key as unknown for now without remembering that.
      if (++this.loads > MAX_LOADS_PER_WINDOW) return null
      value = await this.load(siteKey)
      await this.cache
        ?.put(siteKey, value ? JSON.stringify(value) : UNKNOWN, {
          expirationTtl: value ? KNOWN_TTL_S : UNKNOWN_TTL_S,
        })
        .catch(() => {})
    }
    this.memory.set(siteKey, { value, expires: now + MEMORY_TTL_MS })
    return value
  }

  async invalidate(siteKey: string): Promise<void> {
    this.memory.delete(siteKey)
    await this.cache?.delete(siteKey).catch(() => {})
  }
}
