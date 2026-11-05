#!/usr/bin/env node
// The dashboard's Vercel build: apply pending migrations on production builds, then build.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * Only a production build migrates. Preview and local builds never do, even with a
 * DATABASE_URL, because that URL could be production's.
 */
export function migrationStep(env) {
  if (env.VERCEL_ENV !== 'production') {
    return { action: 'skip', reason: `VERCEL_ENV is ${env.VERCEL_ENV || 'unset'}, not production` }
  }
  if (!env.DATABASE_URL) {
    return { action: 'fail', reason: 'DATABASE_URL is not set on a production build' }
  }
  return { action: 'migrate' }
}

const run = (args) => {
  const { status } = spawnSync('pnpm', args, { stdio: 'inherit' })
  if (status !== 0) process.exit(status ?? 1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const step = migrationStep(process.env)
  if (step.action === 'fail') {
    console.error(`Migrations: ${step.reason}.`)
    process.exit(1)
  }
  if (step.action === 'skip') console.log(`Migrations skipped: ${step.reason}.`)
  else run(['--filter', '@copper/db', 'migrate'])
  run(['turbo', 'run', 'build', '--filter=@copper/web'])
}
