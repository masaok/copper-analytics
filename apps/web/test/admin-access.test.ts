import { describe, expect, it } from 'vitest'
import { isAdmin } from '../src/features/admin/access'

describe('isAdmin', () => {
  const admin = 'owner@example.com'

  it('admits the verified owner of the admin address, in any case', () => {
    expect(isAdmin({ email: 'Owner@Example.com', emailVerified: true }, admin)).toBe(true)
  })

  it('refuses the same address when no provider verified it', () => {
    expect(isAdmin({ email: admin, emailVerified: false }, admin)).toBe(false)
  })

  it('refuses everyone else, and everyone when no admin is set', () => {
    expect(isAdmin({ email: 'other@example.com', emailVerified: true }, admin)).toBe(false)
    expect(isAdmin({ email: admin, emailVerified: true }, undefined)).toBe(false)
  })
})
