import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { seal, unseal } = await import('../src/features/settings/secret-box')

describe('seal', () => {
  it('round-trips, and never stores the plain text', () => {
    const sealed = seal('abcdef0123456789abcdef0123456789', 'secret')
    expect(sealed).not.toContain('abcdef0123456789')
    expect(unseal(sealed, 'secret')).toBe('abcdef0123456789abcdef0123456789')
  })

  it('uses a fresh IV each time', () => {
    expect(seal('same', 'secret')).not.toBe(seal('same', 'secret'))
  })

  it('fails with another secret or a changed ciphertext', () => {
    const sealed = seal('key', 'secret')
    expect(() => unseal(sealed, 'other')).toThrow()
    const [iv, tag, data] = sealed.split('.')
    const flipped = Buffer.from(data as string, 'base64url')
    flipped[0] = (flipped[0] ?? 0) ^ 1
    expect(() => unseal([iv, tag, flipped.toString('base64url')].join('.'), 'secret')).toThrow()
  })
})
