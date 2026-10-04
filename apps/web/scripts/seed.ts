// Creates a demo account, a few projects and 30 days of made-up traffic.
// Safe to run again: the flush log skips hours that were already written.
import { type FlushUnit, HOUR_MS, shardOf, syntheticEvents, unitsFrom } from '@copper/core'
import { PgStore, schema } from '@copper/db'
import { createNodeDb } from '@copper/db/node'
import { hashPassword } from 'better-auth/crypto'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. See .env.example.')
  process.exit(1)
}

const DAYS = Number(process.env.SEED_DAYS ?? 30)
const SITES: [siteKey: string, name: string, domain: string, visitsPerDay: number][] = [
  ['demoshop01', 'Acme shop', 'shop.acme.test', 420],
  ['demoblog02', 'Engineering blog', 'blog.acme.test', 180],
  ['demodocs03', 'Docs', 'docs.acme.test', 95],
  ['demoside04', 'Weekend side project', 'tinytool.test', 22],
  ['demoland05', 'Landing page', 'launch.acme.test', 8],
]
const count = Number(process.env.SEED_PROJECTS ?? SITES.length)
// Past the named sites, generate as many small ones as asked for.
for (let n = SITES.length + 1; n <= count; n++) {
  const id = String(n).padStart(6, '0')
  SITES.push([`demo${id}`, `Side project ${n}`, `project-${n}.test`, 5 + ((n * 37) % 90)])
}
const password = process.env.DEMO_PASSWORD ?? 'copper-demo'
const email = 'demo@copper.local'

const { db, pool } = createNodeDb(url, { max: 1 })
const store = new PgStore(db)

await db
  .insert(schema.user)
  .values({ id: 'demo', name: 'Demo', email, emailVerified: true })
  .onConflictDoNothing()
await db
  .insert(schema.account)
  .values({
    id: 'demo-credential',
    accountId: 'demo',
    providerId: 'credential',
    userId: 'demo',
    password: await hashPassword(password),
  })
  .onConflictDoUpdate({
    target: schema.account.id,
    set: { password: await hashPassword(password) },
  })

const to = Math.floor(Date.now() / HOUR_MS) * HOUR_MS
const from = to - DAYS * 24 * HOUR_MS
const byShard = new Map<number, Map<string, FlushUnit>>()

for (const [index, [siteKey, name, domain, visitsPerDay]] of SITES.slice(0, count).entries()) {
  await db
    .insert(schema.project)
    .values({ siteKey, name, ownerId: 'demo', domains: [domain] })
    .onConflictDoNothing()
  const units = unitsFrom(syntheticEvents({ siteKey, from, to, visitsPerDay, seed: index + 1 }))
  const shard = shardOf(siteKey)
  const hours = byShard.get(shard) ?? new Map<string, FlushUnit>()
  byShard.set(shard, hours)
  for (const unit of units) {
    const existing = hours.get(unit.hour)
    if (existing) existing.projects.push(...unit.projects)
    else hours.set(unit.hour, { ...unit, flushId: `seed:${unit.hour}` })
  }
}

let applied = 0
for (const [shard, hours] of byShard) {
  const units = [...hours.values()]
  for (let i = 0; i < units.length; i += 48) {
    applied += (await store.applyFlush(shard, units.slice(i, i + 48))).applied.length
  }
}
await pool.end()

console.log(`Seeded ${count} projects and ${applied} new flush units over ${DAYS} days.`)
console.log(`Demo sign-in (needs COPPER_DEMO_LOGIN=1): ${email} / ${password}`)
