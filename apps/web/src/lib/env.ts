import 'server-only'

const REQUIRED = {
  DATABASE_URL: 'Postgres connection string',
  BETTER_AUTH_SECRET: 'random string that signs session cookies (openssl rand -base64 32)',
  BETTER_AUTH_URL: 'public URL of this app, e.g. http://localhost:3000',
} as const

export interface Env {
  DATABASE_URL: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  github?: { clientId: string; clientSecret: string }
  google?: { clientId: string; clientSecret: string }
  /** Sign in with JustAuth (https://justauth.org), a generic OAuth 2.0 provider. */
  justauth?: { clientId: string; clientSecret: string; url: string; redirectURI?: string }
  /** Other sites allowed to start sign-in here, e.g. a marketing site that proxies /api/auth. */
  trustedOrigins: string[]
  /** Email and password sign-in for the seeded demo account. For local and self-host trials only. */
  demoLogin: boolean
  mode: 'simple' | 'edge'
  ingestUrl?: string
  ingestSecret?: string
  revalidateSecret?: string
  cookieDomain?: string
  /** A Google service account that can read Search Console, for the /search-console page. */
  searchConsole?: { clientEmail: string; privateKey: string }
  debug: boolean
}

const pair = (id?: string, secret?: string) =>
  id && secret ? { clientId: id, clientSecret: secret } : undefined

/** The client email and private key from a service account's JSON key, the file Google downloads. */
function serviceAccount(json: string | undefined, problems: string[]) {
  if (!json) return undefined
  try {
    const key = JSON.parse(json) as { client_email?: unknown; private_key?: unknown }
    if (typeof key.client_email === 'string' && typeof key.private_key === 'string') {
      return { clientEmail: key.client_email, privateKey: key.private_key }
    }
  } catch {}
  problems.push(
    'GOOGLE_SERVICE_ACCOUNT_JSON: a service account JSON key with client_email and private_key',
  )
  return undefined
}

/** Reads and checks configuration once. A missing variable fails here, by name, not deep in a library. */
export function readEnv(source: Record<string, string | undefined>): Env {
  const missing = Object.entries(REQUIRED).filter(([key]) => !source[key])
  const github = pair(source.GITHUB_CLIENT_ID, source.GITHUB_CLIENT_SECRET)
  const google = pair(source.GOOGLE_CLIENT_ID, source.GOOGLE_CLIENT_SECRET)
  const justauthPair = pair(source.JUSTAUTH_CLIENT_ID, source.JUSTAUTH_CLIENT_SECRET)
  const justauth = justauthPair && {
    ...justauthPair,
    url: (source.JUSTAUTH_URL ?? 'https://www.justauth.org').replace(/\/$/, ''),
    redirectURI: source.JUSTAUTH_REDIRECT_URI || undefined,
  }
  const demoLogin = source.COPPER_DEMO_LOGIN === '1'
  const mode = source.COPPER_MODE === 'edge' ? 'edge' : 'simple'
  const problems = missing.map(([key, what]) => `${key}: ${what}`)
  if (!github && !google && !justauth && !demoLogin) {
    problems.push(
      'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET: a GitHub OAuth app, or JUSTAUTH_CLIENT_ID and JUSTAUTH_CLIENT_SECRET, or set COPPER_DEMO_LOGIN=1',
    )
  }
  if (mode === 'edge' && !(source.INGEST_URL && source.INGEST_SECRET)) {
    problems.push('INGEST_URL and INGEST_SECRET: required when COPPER_MODE=edge')
  }
  const searchConsole = serviceAccount(source.GOOGLE_SERVICE_ACCOUNT_JSON, problems)
  if (problems.length > 0) {
    throw new Error(
      `Missing configuration:\n  ${problems.join('\n  ')}\nSee .env.example and docs/SELF_HOSTING.md.`,
    )
  }
  return {
    DATABASE_URL: source.DATABASE_URL as string,
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET as string,
    BETTER_AUTH_URL: (source.BETTER_AUTH_URL as string).replace(/\/$/, ''),
    github,
    google,
    justauth,
    trustedOrigins: (source.TRUSTED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
    demoLogin,
    mode,
    ingestUrl: source.INGEST_URL?.replace(/\/$/, ''),
    ingestSecret: source.INGEST_SECRET,
    revalidateSecret: source.REVALIDATE_SECRET,
    cookieDomain: source.COOKIE_DOMAIN,
    searchConsole,
    debug: source.COPPER_DEBUG === '1',
  }
}

let cached: Env | undefined
export const env = (): Env => {
  cached ??= readEnv(process.env)
  return cached
}
