import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import { runMigrations, type SqlClient } from '../src/migrate'
import { loadMigrations } from '../src/migrations-dir'
import { createTestDb } from '../src/testing'

const clientOf = (pg: PGlite): SqlClient => ({
  query: (text, params) => pg.query(text, params as unknown[]),
})

describe('migrations', () => {
  it('apply from an empty database and create every table in the data model', async () => {
    const { client, applied } = await createTestDb()
    expect(applied).toEqual(loadMigrations().map((m) => m.name))
    const tables = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1",
    )
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      'account',
      'breakdown_daily',
      'breakdown_monthly',
      'copper_migrations',
      'db_size_log',
      'flush_log',
      'project',
      'session',
      'stats_daily',
      'stats_hourly',
      'user',
      'verification',
    ])
  })

  it('are named so that file order is application order', () => {
    const names = loadMigrations().map((m) => m.name)
    expect(names.length).toBeGreaterThan(0)
    names.forEach((name, i) => {
      expect(name).toMatch(new RegExp(`^${String(i).padStart(4, '0')}_[a-z0-9_]+\\.sql$`))
    })
  })

  it('skip what is already applied', async () => {
    const pg = new PGlite()
    const migrations = [
      { name: '0000_a.sql', sql: 'create table a (id int)' },
      { name: '0001_b.sql', sql: 'create table b (id int)' },
    ]
    expect(await runMigrations(clientOf(pg), migrations.slice(0, 1))).toEqual(['0000_a.sql'])
    expect(await runMigrations(clientOf(pg), migrations)).toEqual(['0001_b.sql'])
    expect(await runMigrations(clientOf(pg), migrations)).toEqual([])
  })

  it('roll a failing migration back and do not record it', async () => {
    const pg = new PGlite()
    const bad = {
      name: '0000_bad.sql',
      sql: 'create table kept (id int)--> statement-breakpoint\nselect * from missing_table',
    }
    await expect(runMigrations(clientOf(pg), [bad])).rejects.toThrow('0000_bad.sql failed')
    const kept = await pg.query("select to_regclass('public.kept') as t")
    expect(kept.rows).toEqual([{ t: null }])
    const recorded = await pg.query('select name from copper_migrations')
    expect(recorded.rows).toEqual([])
    // The advisory lock was released, so a later run is not stuck behind it.
    expect(await runMigrations(clientOf(pg), [{ name: '0000_ok.sql', sql: 'select 1' }])).toEqual([
      '0000_ok.sql',
    ])
  })
})
