import 'server-only'
import { createSign } from 'node:crypto'
import { env } from '@/lib/env'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export const SCOPES = {
  searchConsole: 'https://www.googleapis.com/auth/webmasters.readonly',
  analytics: 'https://www.googleapis.com/auth/analytics.readonly',
} as const
type Scope = (typeof SCOPES)[keyof typeof SCOPES]

const tokens = new Map<Scope, { value: string; expires: number }>()

/** An access token from the service account's key (a signed JWT exchanged at Google), reused until it nearly expires. */
async function accessToken(scope: Scope): Promise<string> {
  const cached = tokens.get(scope)
  if (cached && cached.expires > Date.now() + 60_000) return cached.value
  const account = env().googleServiceAccount
  if (!account) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set')
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: account.clientEmail,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.privateKey, 'base64url')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
    cache: 'no-store',
  })
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string }
  if (!body.access_token) throw new Error(`Google sign-in failed: ${body.error ?? res.status}`)
  tokens.set(scope, {
    value: body.access_token,
    expires: Date.now() + (body.expires_in ?? 3600) * 1000,
  })
  return body.access_token
}

/** A GET, or a POST when there is a body, to a Google API as the service account. */
export async function googleApi<T>(scope: Scope, url: string, body?: object): Promise<T> {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      authorization: `Bearer ${await accessToken(scope)}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(detail?.error?.message ?? `Google answered ${res.status}`)
  }
  return (await res.json()) as T
}
