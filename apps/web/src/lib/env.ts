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
  /** Email and password sign-in for the seeded demo account. For local and self-host trials only. */
  demoLogin: boolean
  mode: 'simple' | 'edge'
  ingestUrl?: string
  ingestSecret?: string
  revalidateSecret?: string
  cookieDomain?: string
  debug: boolean
}

const pair = (id?: string, secret?: string) =>
  id && secret ? { clientId: id, clientSecret: secret } : undefined

/** Reads and checks configuration once. A missing variable fails here, by name, not deep in a library. */
export function readEnv(source: Record<string, string | undefined>): Env {
  const missing = Object.entries(REQUIRED).filter(([key]) => !source[key])
  const github = pair(source.GITHUB_CLIENT_ID, source.GITHUB_CLIENT_SECRET)
  const google = pair(source.GOOGLE_CLIENT_ID, source.GOOGLE_CLIENT_SECRET)
  const demoLogin = source.COPPER_DEMO_LOGIN === '1'
  const mode = source.COPPER_MODE === 'edge' ? 'edge' : 'simple'
  const problems = missing.map(([key, what]) => `${key}: ${what}`)
  if (!github && !google && !demoLogin) {
    problems.push(
      'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET: a GitHub OAuth app, or set COPPER_DEMO_LOGIN=1',
    )
  }
  if (mode === 'edge' && !(source.INGEST_URL && source.INGEST_SECRET)) {
    problems.push('INGEST_URL and INGEST_SECRET: required when COPPER_MODE=edge')
  }
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
    demoLogin,
    mode,
    ingestUrl: source.INGEST_URL?.replace(/\/$/, ''),
    ingestSecret: source.INGEST_SECRET,
    revalidateSecret: source.REVALIDATE_SECRET,
    cookieDomain: source.COOKIE_DOMAIN,
    debug: source.COPPER_DEBUG === '1',
  }
}

let cached: Env | undefined
export const env = (): Env => {
  cached ??= readEnv(process.env)
  return cached
}
