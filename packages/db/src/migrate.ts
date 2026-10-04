/** The smallest client the runner needs. `pg` clients and PGlite both satisfy it. */
export interface SqlClient {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>
}

export interface Migration {
  name: string
  sql: string
}

const LOCK_KEY = 7_267_737 // arbitrary; identifies the Copper migration lock

/**
 * Applies migrations that are not yet recorded in `copper_migrations`, in name order.
 * An advisory lock makes concurrent runners wait instead of interleaving, and each
 * migration commits with its bookkeeping row or not at all.
 */
export async function runMigrations(client: SqlClient, migrations: Migration[]): Promise<string[]> {
  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name))
  const applied: string[] = []
  await client.query('select pg_advisory_lock($1)', [LOCK_KEY])
  try {
    await client.query(
      `create table if not exists copper_migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`,
    )
    const done = new Set(
      (await client.query('select name from copper_migrations')).rows.map(
        (r) => (r as { name: string }).name,
      ),
    )
    for (const migration of ordered) {
      if (done.has(migration.name)) continue
      await client.query('begin')
      try {
        for (const statement of migration.sql.split('--> statement-breakpoint')) {
          if (statement.trim()) await client.query(statement)
        }
        await client.query('insert into copper_migrations (name) values ($1)', [migration.name])
        await client.query('commit')
      } catch (error) {
        await client.query('rollback')
        throw new Error(`Migration ${migration.name} failed: ${(error as Error).message}`, {
          cause: error,
        })
      }
      applied.push(migration.name)
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY])
  }
  return applied
}
