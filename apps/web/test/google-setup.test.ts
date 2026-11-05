import { describe, expect, it } from 'vitest'
import { googleSetup } from '../src/features/google/setup'

const none = { analyticsHosts: [], siteUrls: [] }

describe('googleSetup', () => {
  it('counts a web stream on the domain or a subdomain as Analytics, but not a look-alike', () => {
    expect(googleSetup('example.com', { ...none, analyticsHosts: ['example.com'] })).toEqual({
      analytics: true,
      searchConsole: false,
    })
    expect(googleSetup('example.com', { ...none, analyticsHosts: ['shop.example.com'] })).toEqual({
      analytics: true,
      searchConsole: false,
    })
    expect(googleSetup('example.com', { ...none, analyticsHosts: ['notexample.com'] })).toEqual({
      analytics: false,
      searchConsole: false,
    })
  })

  it('counts a domain property on the domain or a parent, and a URL-prefix property on it', () => {
    expect(googleSetup('example.com', { ...none, siteUrls: ['sc-domain:example.com'] })).toEqual({
      analytics: false,
      searchConsole: true,
    })
    expect(
      googleSetup('shop.example.com', { ...none, siteUrls: ['sc-domain:example.com'] }),
    ).toEqual({ analytics: false, searchConsole: true })
    expect(googleSetup('example.com', { ...none, siteUrls: ['https://www.example.com/'] })).toEqual(
      { analytics: false, searchConsole: true },
    )
  })

  it('does not count a property on a look-alike or a parent URL prefix', () => {
    expect(
      googleSetup('example.com', {
        analyticsHosts: [],
        siteUrls: ['sc-domain:notexample.com', 'https://notexample.com/', 'not a url'],
      }),
    ).toEqual({ analytics: false, searchConsole: false })
    expect(
      googleSetup('shop.example.com', { ...none, siteUrls: ['https://example.com/'] }),
    ).toEqual({ analytics: false, searchConsole: false })
  })
})
