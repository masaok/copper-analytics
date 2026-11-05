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

  it('reads the admin address, lowercased, and leaves it unset when empty', () => {
    const demo = { ...base, COPPER_DEMO_LOGIN: '1' }
    expect(readEnv({ ...demo, ADMIN_EMAIL: ' Owner@Example.com ' }).adminEmail).toBe(
      'owner@example.com',
    )
    expect(readEnv({ ...demo, ADMIN_EMAIL: '' }).adminEmail).toBeUndefined()
  })

  it('requires a way to sign in', () => {
    expect(() => readEnv(base)).toThrow(/GITHUB_CLIENT_ID/)
    expect(readEnv({ ...base, COPPER_DEMO_LOGIN: '1' }).demoLogin).toBe(true)
    expect(readEnv({ ...base, GITHUB_CLIENT_ID: 'a', GITHUB_CLIENT_SECRET: 'b' }).github).toEqual({
      clientId: 'a',
      clientSecret: 'b',
    })
  })

  it('accepts JustAuth as the only sign-in, with a redirect on another host', () => {
    const config = readEnv({
      ...base,
      JUSTAUTH_CLIENT_ID: 'ja_1',
      JUSTAUTH_CLIENT_SECRET: 'jas_1',
      JUSTAUTH_REDIRECT_URI: 'https://www.example.com/api/auth/callback/justauth',
      TRUSTED_ORIGINS: 'https://www.example.com/, https://example.com',
    })
    expect(config.justauth).toEqual({
      clientId: 'ja_1',
      clientSecret: 'jas_1',
      url: 'https://www.justauth.org',
      redirectURI: 'https://www.example.com/api/auth/callback/justauth',
    })
    expect(config.trustedOrigins).toEqual(['https://www.example.com', 'https://example.com'])
    expect(readEnv({ ...base, COPPER_DEMO_LOGIN: '1' }).trustedOrigins).toEqual([])
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

  it('reads a Search Console service account key, and names a bad one', () => {
    const signIn = { ...base, COPPER_DEMO_LOGIN: '1' }
    expect(readEnv(signIn).googleServiceAccount).toBeUndefined()
    const key = JSON.stringify({ client_email: 'a@b.iam', private_key: '-----KEY-----\nabc\n' })
    expect(readEnv({ ...signIn, GOOGLE_SERVICE_ACCOUNT_JSON: key }).googleServiceAccount).toEqual({
      clientEmail: 'a@b.iam',
      privateKey: '-----KEY-----\nabc\n',
    })
    expect(() => readEnv({ ...signIn, GOOGLE_SERVICE_ACCOUNT_JSON: '{nope' })).toThrow(
      /GOOGLE_SERVICE_ACCOUNT_JSON/,
    )
  })
})
