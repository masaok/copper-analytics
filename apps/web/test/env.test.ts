import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { readEnv } = await import('../src/lib/env')

const base = {
  DATABASE_URL: 'postgres://x',
  BETTER_AUTH_SECRET: 's',
  BETTER_AUTH_URL: 'http://localhost:3000/',
}

describe('readEnv', () => {
  it('names every missing variable in one error', () => {
    expect(() => readEnv({})).toThrow(
      /DATABASE_URL.*\n.*BETTER_AUTH_SECRET.*\n.*BETTER_AUTH_URL.*\n.*GITHUB_CLIENT_ID/,
    )
  })

  it('requires a way to sign in', () => {
    expect(() => readEnv(base)).toThrow(/GITHUB_CLIENT_ID/)
    expect(readEnv({ ...base, COPPER_DEMO_LOGIN: '1' }).demoLogin).toBe(true)
    expect(readEnv({ ...base, GITHUB_CLIENT_ID: 'a', GITHUB_CLIENT_SECRET: 'b' }).github).toEqual({
      clientId: 'a',
      clientSecret: 'b',
    })
  })

  it('requires the ingest settings in edge mode and defaults to simple mode', () => {
    const signIn = { ...base, COPPER_DEMO_LOGIN: '1' }
    expect(readEnv(signIn).mode).toBe('simple')
    expect(() => readEnv({ ...signIn, COPPER_MODE: 'edge' })).toThrow(/INGEST_URL/)
    expect(
      readEnv({ ...signIn, COPPER_MODE: 'edge', INGEST_URL: 'https://e.x/', INGEST_SECRET: 's' }),
    ).toMatchObject({
      mode: 'edge',
      ingestUrl: 'https://e.x',
      BETTER_AUTH_URL: 'http://localhost:3000',
    })
  })
})
