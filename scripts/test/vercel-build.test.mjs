import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migrationStep } from '../vercel-build.mjs'

const url = 'postgres://u:p@db.example/copper'

test('a production build with a database URL migrates', () => {
  assert.deepEqual(migrationStep({ VERCEL_ENV: 'production', DATABASE_URL: url }), {
    action: 'migrate',
  })
})

test('a production build without a database URL fails by name', () => {
  assert.deepEqual(migrationStep({ VERCEL_ENV: 'production' }), {
    action: 'fail',
    reason: 'DATABASE_URL is not set on a production build',
  })
})

test('a preview build never migrates, even with a database URL', () => {
  assert.deepEqual(migrationStep({ VERCEL_ENV: 'preview', DATABASE_URL: url }), {
    action: 'skip',
    reason: 'VERCEL_ENV is preview, not production',
  })
})

test('a build outside Vercel never migrates', () => {
  assert.deepEqual(migrationStep({ DATABASE_URL: url }), {
    action: 'skip',
    reason: 'VERCEL_ENV is unset, not production',
  })
})
