import pg from 'pg'
import { runMigrations } from './migrate'
import { loadMigrations } from './migrations-dir'

/** Applies pending migrations from the `migrations` directory. For scripts, not for bundled apps. */
export async function migrate(url: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await runMigrations(client, loadMigrations())
  } finally {
    await client.end()
  }
}

export { loadMigrations, MIGRATIONS_DIR } from './migrations-dir'
