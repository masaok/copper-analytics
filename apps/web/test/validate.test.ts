import { describe, expect, it } from 'vitest'
import { normalizeDomain, parseProjectInput } from '../src/features/projects/validate'

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [k, v] of Object.entries(fields)) data.set(k, v)
  return data
}

describe('project input', () => {
  it('normalizes domains to bare hostnames', () => {
    expect(normalizeDomain('https://www.Acme.io/pricing?x=1')).toBe('acme.io')
    expect(normalizeDomain('shop.acme.io:8080')).toBe('shop.acme.io')
    expect(normalizeDomain('localhost:3000')).toBe('localhost')
    expect(normalizeDomain('not a domain')).toBeNull()
    expect(normalizeDomain('acme')).toBeNull()
  })

  it('accepts a valid project and removes duplicate domains', () => {
    expect(
      parseProjectInput(
        form({
          name: ' Acme ',
          domains: 'acme.io, www.acme.io\nshop.acme.io',
          timezone: 'Europe/Berlin',
        }),
      ),
    ).toEqual({
      ok: true,
      value: { name: 'Acme', domains: ['acme.io', 'shop.acme.io'], timezone: 'Europe/Berlin' },
    })
  })

  it('explains what is wrong with a bad name, domain or timezone', () => {
    expect(parseProjectInput(form({ name: '' }))).toMatchObject({ ok: false })
    expect(parseProjectInput(form({ name: 'A', domains: 'http://' }))).toEqual({
      ok: false,
      error: '"http://" is not a domain. Use a form like acme.io.',
    })
    expect(parseProjectInput(form({ name: 'A', timezone: 'Mars/Olympus' }))).toEqual({
      ok: false,
      error: '"Mars/Olympus" is not a timezone. Use a form like Europe/Berlin.',
    })
  })
})
