import 'server-only'
import {
  type EventBuffer,
  flush,
  type LiveSummary,
  MemoryBuffer,
  ProjectDirectory,
  type TodaySnapshot,
} from '@copper/core'
import { PgStore } from '@copper/db'
import { db } from './db'
import { env } from './env'

const EMPTY_TODAY: TodaySnapshot = {
  pageviews: 0,
  visitors: 0,
  dayVisitors: 0,
  visits: 0,
  bounces: 0,
  breakdown: {},
  hours: {},
}

/** The read side of a buffer: what has arrived since the last flush. */
export type LiveSource = Pick<EventBuffer, 'live' | 'today' | 'summary'>

interface SimpleMode {
  buffer: MemoryBuffer
  projects: ProjectDirectory
  timer?: ReturnType<typeof setInterval>
  lastDaily?: string
}
const globals = globalThis as { __copperSimple?: SimpleMode }

/** Simple mode keeps one buffer and one project cache for the life of the process. */
export function simpleMode(): SimpleMode {
  globals.__copperSimple ??= {
    buffer: new MemoryBuffer(),
    projects: new ProjectDirectory((siteKey) => new PgStore(db()).projectConfig(siteKey)),
  }
  return globals.__copperSimple
}

/** Writes the in-process buffer to the database. Runs on a timer and once more at shutdown. */
export async function flushSimple(now = Date.now()): Promise<void> {
  const state = simpleMode()
  const store = new PgStore(db())
  await flush(state.buffer, store, 0, now)
  const today = new Date(now).toISOString().slice(0, 10)
  if (state.lastDaily !== today) {
    await store.runDaily(new Date(now))
    state.lastDaily = today
  }
}

/** Starts the flush timer once. Called when the server boots and again, harmlessly, on each pageview. */
export function ensureFlusher(): void {
  const state = simpleMode()
  if (state.timer) return
  const seconds = Number(process.env.COPPER_FLUSH_SECONDS ?? 300)
  state.timer = setInterval(() => {
    flushSimple().catch((error) => console.error('Copper flush failed:', error))
  }, seconds * 1000)
  state.timer.unref?.()
  const onExit = () => {
    flushSimple().finally(() => process.exit(0))
  }
  process.once('SIGTERM', onExit)
  process.once('SIGINT', onExit)
}

async function fromIngest<T>(path: string, fallback: T): Promise<T> {
  const { ingestUrl, ingestSecret } = env()
  try {
    const res = await fetch(`${ingestUrl}${path}`, {
      headers: { Authorization: `Bearer ${ingestSecret}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return res.ok ? ((await res.json()) as T) : fallback
  } catch {
    // The dashboard still renders history when the Worker cannot be reached.
    return fallback
  }
}

const edgeSource: LiveSource = {
  live: async (siteKey) =>
    (await fromIngest<{ live: number }>(`/live?site=${siteKey}`, { live: 0 })).live,
  today: (siteKey) => fromIngest<TodaySnapshot>(`/today?site=${siteKey}`, EMPTY_TODAY),
  summary: async (siteKeys) => {
    if (siteKeys.length === 0) return {}
    const found = await fromIngest<Record<string, LiveSummary>>(
      `/overview?sites=${siteKeys.join(',')}`,
      {},
    )
    return Object.fromEntries(
      siteKeys.map((key) => [key, found[key] ?? { live: 0, pageviews: 0, dayVisitors: 0 }]),
    )
  },
}

export const liveSource = (): LiveSource =>
  env().mode === 'edge' ? edgeSource : simpleMode().buffer

/** Tells the ingest Worker to forget a cached project. A no-op in simple mode beyond the local cache. */
export async function invalidateProject(siteKey: string): Promise<void> {
  const config = env()
  if (config.mode === 'simple') {
    await simpleMode().projects.invalidate(siteKey)
    return
  }
  await fetch(`${config.ingestUrl}/invalidate?site=${siteKey}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.ingestSecret}` },
    signal: AbortSignal.timeout(3000),
  }).catch(() => {})
}
