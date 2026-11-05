import { describe, expect, it } from 'vitest'
import { daysBetween, isGoogleRangeId, searchWindow } from '../src/features/google/ranges'
import { matchSites, propertyHost, siteFor } from '../src/features/search-console/sites'

const projects = [
  { name: 'Quick', domains: ['quickbankconvert.com'] },
  { name: 'Shop', domains: ['shop.acme.test'] },
  { name: 'Blog', domains: ['www.blog.test'] },
]

describe('propertyHost', () => {
  it('reads domain and URL-prefix properties as a bare host', () => {
    expect(propertyHost('sc-domain:Example.com')).toBe('example.com')
    expect(propertyHost('https://www.example.com/')).toBe('example.com')
    expect(propertyHost('not a url')).toBeNull()
  })
})

describe('matchSites', () => {
  it('keeps only the properties that cover a project domain', () => {
    const sites = matchSites(
      ['sc-domain:quickbankconvert.com', 'sc-domain:someone-else.com', 'sc-domain:acme.test'],
      projects,
    )
    expect(sites).toEqual([
      { siteUrl: 'sc-domain:acme.test', host: 'acme.test', projectName: 'Shop' },
      {
        siteUrl: 'sc-domain:quickbankconvert.com',
        host: 'quickbankconvert.com',
        projectName: 'Quick',
      },
    ])
  })

  it('does not let a URL-prefix property cover subdomains', () => {
    expect(matchSites(['https://acme.test/'], projects)).toEqual([])
    expect(matchSites(['https://blog.test/'], projects)).toHaveLength(1)
  })

  it('prefers the domain property when both exist for a host', () => {
    const urls = ['https://quickbankconvert.com/', 'sc-domain:quickbankconvert.com']
    expect(matchSites(urls, projects)[0]?.siteUrl).toBe('sc-domain:quickbankconvert.com')
    expect(matchSites(urls.reverse(), projects)[0]?.siteUrl).toBe('sc-domain:quickbankconvert.com')
  })
})

describe('dates', () => {
  it('ends the window yesterday and counts every day', () => {
    const window = searchWindow(7, Date.parse('2026-11-04T10:00:00Z'))
    expect(window).toEqual({ from: '2026-10-28', to: '2026-11-03' })
    expect(daysBetween(window.from, window.to)).toHaveLength(7)
  })

  it('accepts only known ranges', () => {
    expect(isGoogleRangeId('28d')).toBe(true)
    expect(isGoogleRangeId('toString')).toBe(false)
  })
})

describe('siteFor', () => {
  const sites = [
    { site: { siteUrl: 'sc-domain:acme.test', host: 'acme.test', projectName: 'Shop' } },
    { site: { siteUrl: 'https://blog.test/', host: 'blog.test', projectName: 'Blog' } },
  ]

  it('finds a site by its host', () => {
    expect(siteFor(sites, 'blog.test')).toBe(sites[1])
  })

  it('finds the domain property that covers a subdomain', () => {
    expect(siteFor(sites, 'shop.acme.test')).toBe(sites[0])
  })

  it('does not stretch a URL-prefix property over a subdomain', () => {
    expect(siteFor(sites, 'www2.blog.test')).toBeUndefined()
    expect(siteFor(sites, 'other.test')).toBeUndefined()
  })
})
