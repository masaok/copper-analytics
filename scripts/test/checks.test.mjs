// Each check is run against a fixture that must make it fail, so a green run means it looked.
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkDocs } from '../check-docs.mjs'
import { checkFeatureMap, surfacesOf } from '../check-feature-map.mjs'

const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url))

test('check-docs reports a missing file and a missing heading, and nothing else', () => {
  const { problems } = checkDocs(join(fixtures, 'docs-bad'), ['a.md', 'other.md'])
  assert.deepEqual(problems, [
    'a.md: broken link ./missing.md',
    'a.md: missing heading ./other.md#nope',
  ])
})

test('check-feature-map reports a route with no row', () => {
  const root = join(fixtures, 'map-bad')
  const { routes, missing } = checkFeatureMap(root, surfacesOf(root))
  assert.deepEqual(routes.sort(), ['web:/', 'web:/secret'])
  assert.deepEqual(missing, ['web:/secret'])
})
