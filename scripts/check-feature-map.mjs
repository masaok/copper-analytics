#!/usr/bin/env node
// Fails when a route exists in code and has no row in docs/feature-map.md.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  )
}

/** Routes served by a Next.js `app` directory, from its page and route files. */
export function nextRoutes(appDir) {
  return walk(appDir)
    .filter((f) => /\/(page\.tsx|route\.ts)$/.test(f))
    .map((f) => {
      const segments = f
        .slice(appDir.length)
        .split('/')
        .slice(0, -1)
        .filter((s) => s && !/^\(.*\)$/.test(s))
      return `/${segments.join('/')}`
    })
}

/** Routes a Worker declares in its `routes.ts` as `'/path'` string literals. */
export function workerRoutes(routesFile) {
  if (!existsSync(routesFile)) return []
  return [...readFileSync(routesFile, 'utf8').matchAll(/'(\/[a-z/-]*)'/g)].map((m) => m[1])
}

export function checkFeatureMap(root, surfaces) {
  const mapFile = join(root, 'docs/feature-map.md')
  const map = existsSync(mapFile) ? readFileSync(mapFile, 'utf8') : ''
  const routes = surfaces.flatMap(({ id, routes }) => routes.map((r) => `${id}:${r}`))
  return { routes, missing: routes.filter((r) => !map.includes(`\`${r}\``)) }
}

export const surfacesOf = (root) => [
  { id: 'web', routes: nextRoutes(join(root, 'apps/web/src/app')) },
  { id: 'ingest', routes: workerRoutes(join(root, 'apps/ingest/src/routes.ts')) },
]

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd()
  const { routes, missing } = checkFeatureMap(root, surfacesOf(root))
  for (const r of missing) console.error(`docs/feature-map.md has no row for \`${r}\``)
  if (routes.length === 0) {
    console.error(
      'check-feature-map found no routes, which means it is looking in the wrong place.',
    )
    process.exit(1)
  }
  console.log(`check-feature-map: ${routes.length} routes, ${missing.length} missing`)
  process.exit(missing.length ? 1 : 0)
}
