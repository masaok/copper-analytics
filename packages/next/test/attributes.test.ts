import { describe, expect, it } from 'vitest'
import { trackerAttributes } from '../src'

describe('trackerAttributes', () => {
  it('points at the hosted tracker by default', () => {
    expect(trackerAttributes({ siteKey: 'k3x9q2m7ab' })).toEqual({
      src: 'https://app.copperanalytics.com/c.js',
      'data-site': 'k3x9q2m7ab',
    })
  })

  it('supports a self-hosted dashboard, a proxy endpoint and localhost counting', () => {
    expect(
      trackerAttributes({
        siteKey: 'k3x9q2m7ab',
        host: 'https://stats.acme.io/',
        api: '/stats/e',
        dev: true,
      }),
    ).toEqual({
      src: 'https://stats.acme.io/c.js',
      'data-site': 'k3x9q2m7ab',
      'data-api': '/stats/e',
      'data-dev': '',
    })
  })
})
