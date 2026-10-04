import { DurableObject } from 'cloudflare:workers'
import type {
  EventBuffer,
  FlushUnit,
  Hit,
  PageEvent,
  ProjectConfig,
  TodaySnapshot,
} from '@copper/core'
import { PgStore } from '@copper/db'
import { createNeonDb } from '@copper/db/neon'
import { filter } from 'copper-filter'
import { createApp } from './app'
import { type ConfigCache, ProjectDirectory } from './projects'
import { BATCH_INTERVAL_MS, ShardCore, type ShardStorage } from './shard-core'

export interface Env {
  SHARD: DurableObjectNamespace<Shard>
  PROJECTS?: KVNamespace
  DATABASE_URL: string
  INGEST_SECRET?: string
  REVALIDATE_SECRET?: string
  APP_URL?: string
  /** Local development only: JSON map of site key to `{ domains, dailyCap }`, used instead of the database. */
  DEV_PROJECTS?: string
}

function sqliteStorage(sql: SqlStorage): ShardStorage {
  sql.exec('create table if not exists meta (key text primary key, value text not null)')
  sql.exec(
    'create table if not exists batch (id integer primary key autoincrement, ts integer not null, events text not null)',
  )
  return {
    getMeta: (key) =>
      sql.exec<{ value: string }>('select value from meta where key = ?', key).toArray()[0]?.value,
    setMeta: (key, value) => {
      sql.exec('insert or replace into meta (key, value) values (?, ?)', key, value)
    },
    appendBatch: (ts, events) => {
      sql.exec('insert into batch (ts, events) values (?, ?)', ts, JSON.stringify(events))
    },
    *batches() {
      for (const row of sql.exec<{ events: string }>('select events from batch order by id')) {
        yield JSON.parse(row.events) as PageEvent[]
      }
    },
    deleteBatchesBefore: (ts) => {
      sql.exec('delete from batch where ts < ?', ts)
    },
  }
}

/** One of 16 shards. Holds the current hour in memory and survives restarts through SQLite. */
export class Shard extends DurableObject<Env> implements EventBuffer {
  private readonly core: ShardCore

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.core = new ShardCore(sqliteStorage(ctx.storage.sql))
  }

  async add(hit: Hit, dailyCap: number): Promise<boolean> {
    const counted = await this.core.add(hit, dailyCap)
    if (this.core.hasUnsaved && (await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + BATCH_INTERVAL_MS)
    }
    return counted
  }

  override async alarm(): Promise<void> {
    this.core.persist()
  }

  live(siteKey: string): Promise<number> {
    return this.core.live(siteKey)
  }
  today(siteKey: string): Promise<TodaySnapshot> {
    return this.core.today(siteKey)
  }
  pending(now: number): Promise<FlushUnit[]> {
    return this.core.pending(now)
  }
  ack(flushIds: string[]): Promise<void> {
    return this.core.ack(flushIds)
  }
}

let directory: ProjectDirectory | undefined

/** A missing secret fails here, by name, not deep in the database driver. */
function assertEnv(env: Env) {
  if (env.DATABASE_URL || env.DEV_PROJECTS) return
  throw new Error(
    'Missing configuration:\n  DATABASE_URL: Neon connection string\nSet it with `wrangler secret put DATABASE_URL`, or in .dev.vars locally. See apps/ingest/wrangler.toml.',
  )
}

function appFor(env: Env, ctx: ExecutionContext) {
  assertEnv(env)
  // One directory per isolate, so its memory cache outlives a request.
  directory ??= new ProjectDirectory(
    async (siteKey) => {
      if (env.DEV_PROJECTS) {
        const found = (JSON.parse(env.DEV_PROJECTS) as Record<string, Partial<ProjectConfig>>)[
          siteKey
        ]
        return found
          ? { siteKey, domains: found.domains ?? [], dailyCap: found.dailyCap ?? 0 }
          : null
      }
      const { db, end } = createNeonDb(env.DATABASE_URL)
      try {
        return await new PgStore(db).projectConfig(siteKey)
      } finally {
        await end()
      }
    },
    env.PROJECTS as ConfigCache | undefined,
  )

  return createApp({
    projects: directory,
    filter,
    shard: (index) =>
      env.SHARD.get(env.SHARD.idFromName(`shard-${index}`)) as unknown as EventBuffer,
    openStore: async () => {
      const { db, end } = createNeonDb(env.DATABASE_URL)
      return { store: new PgStore(db), close: end }
    },
    ingestSecret: env.INGEST_SECRET,
    revalidate: async (siteKeys) => {
      if (!env.APP_URL || !env.REVALIDATE_SECRET) return
      await fetch(`${env.APP_URL.replace(/\/$/, '')}/api/revalidate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.REVALIDATE_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ siteKeys }),
      })
    },
    waitUntil: (work) => ctx.waitUntil(work),
  })
}

export default {
  fetch: (request, env, ctx) => appFor(env, ctx).fetch(request),
  async scheduled(controller, env, ctx) {
    // The 00:05 UTC run also applies retention, rolls up months and records the database size.
    const daily = new Date(controller.scheduledTime).getUTCHours() === 0
    const report = await appFor(env, ctx).runFlush({ daily })
    console.log(JSON.stringify({ flush: report }))
  },
} satisfies ExportedHandler<Env>
