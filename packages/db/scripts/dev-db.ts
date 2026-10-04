// A local Postgres with nothing to install: PGlite behind a TCP socket.
// `pnpm --filter @copper/db dev-db` then use postgres://postgres@localhost:5433/postgres
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { runMigrations } from '../src/migrate'
import { loadMigrations } from '../src/migrations-dir'

const port = Number(process.env.PORT ?? 5433)
const dataDir = process.env.PGLITE_DIR ?? '.pglite'
const db = await PGlite.create(dataDir === 'memory' ? undefined : dataDir)
const applied = await runMigrations(
  { query: (text, params) => db.query(text, params as unknown[]) },
  loadMigrations(),
)
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' })
await server.start()
console.log(`Postgres (PGlite) on postgres://postgres@localhost:${port}/postgres`)
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Schema is up to date.')

const stop = async () => {
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
