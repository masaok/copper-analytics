import { describe, expect, it } from 'vitest'
import { matchProperties, streamHosts } from '../src/features/analytics/properties'

const projects = [
  { name: 'Quick', domains: ['quickbankconvert.com'] },
  { name: 'Shop', domains: ['shop.acme.test'] },
]

describe('streamHosts', () => {
  it('reads stream URIs as bare hosts, once each', () => {
    expect(
      streamHosts([
        'https://www.quickbankconvert.com',
        'https://quickbankconvert.com/',
        undefined,
        'nope',
      ]),
    ).toEqual(['quickbankconvert.com'])
  })
})

describe('matchProperties', () => {
  it('keeps only properties with a stream on a project domain', () => {
    const properties = [
      { id: 'properties/1', displayName: 'quickbankconvert.com', hosts: ['quickbankconvert.com'] },
      { id: 'properties/2', displayName: 'someone else', hosts: ['other.test'] },
      { id: 'properties/3', displayName: 'acme', hosts: ['acme.test'] },
      { id: 'properties/4', displayName: 'duplicate', hosts: ['quickbankconvert.com'] },
    ]
    expect(matchProperties(properties, projects)).toEqual([
      { id: 'properties/1', host: 'quickbankconvert.com', projectName: 'Quick' },
    ])
  })
})
