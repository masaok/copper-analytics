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
 *
 * Each migration runs in its own transaction, which first takes a transaction-level
 * advisory lock and then re-checks the bookkeeping table. A concurrent runner waits on
 * the lock and then sees the migration as done. The lock is transaction-level because a
 * session-level lock is not safe through a transaction-mode pooler such as Neon's.
 */
export async function runMigrations(client: SqlClient, migrations: Migration[]): Promise<string[]> {
  const ordered = [...migrations].sort((a, b) => a.name.localeCompare(b.name))
  const applied: string[] = []

  const inLockedTransaction = async (name: string, body: () => Promise<void>): Promise<void> => {
    await client.query('begin')
    try {
      await client.query('select pg_advisory_xact_lock($1)', [LOCK_KEY])
      await body()
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw new Error(`Migration ${name} failed: ${(error as Error).message}`, { cause: error })
    }
  }

  await inLockedTransaction('bookkeeping', async () => {
    await client.query(
      `create table if not exists copper_migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`,
    )
  })

  for (const migration of ordered) {
    await inLockedTransaction(migration.name, async () => {
      const done = await client.query('select 1 from copper_migrations where name = $1', [
        migration.name,
      ])
      if (done.rows.length > 0) return
      for (const statement of migration.sql.split('--> statement-breakpoint')) {
        if (statement.trim()) await client.query(statement)
      }
      await client.query('insert into copper_migrations (name) values ($1)', [migration.name])
      applied.push(migration.name)
    })
  }
  return applied
}
