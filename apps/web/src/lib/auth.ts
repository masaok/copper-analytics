import 'server-only'
import { schema } from '@copper/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './db'
import { env } from './env'

function createAuth() {
  const config = env()
  return betterAuth({
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    database: drizzleAdapter(db(), { provider: 'pg', schema }),
    socialProviders: {
      ...(config.github ? { github: config.github } : {}),
      ...(config.google ? { google: config.google } : {}),
    },
    emailAndPassword: { enabled: config.demoLogin, disableSignUp: true },
    account: {
      // The same address signs into the same account, but only when the provider says the
      // address is verified. No provider is trusted to skip that check.
      accountLinking: { enabled: true },
    },
    session: {
      // A signed cookie carries the session for five minutes, so most requests skip the database.
      cookieCache: { enabled: true, maxAge: 300 },
    },
    user: {
      additionalFields: {
        projectLimit: { type: 'number', input: false, defaultValue: 10 },
      },
    },
    advanced: config.cookieDomain
      ? { crossSubDomainCookies: { enabled: true, domain: config.cookieDomain } }
      : undefined,
    plugins: [nextCookies()],
  })
}

type Auth = ReturnType<typeof createAuth>
const globals = globalThis as { __copperAuth?: Auth }

/** Built on first use so that `next build` does not need runtime secrets. */
export const auth = (): Auth => {
  globals.__copperAuth ??= createAuth()
  return globals.__copperAuth
}

export interface SessionUser {
  id: string
  name: string
  email: string
  image?: string | null
  projectLimit: number
}

export async function currentUser(): Promise<SessionUser | null> {
  // Reading the request first marks the route dynamic, so a build never reaches the config check.
  const requestHeaders = await headers()
  const session = await auth().api.getSession({ headers: requestHeaders })
  if (!session) return null
  const { id, name, email, image } = session.user
  const projectLimit = (session.user as { projectLimit?: number }).projectLimit ?? 10
  return { id, name, email, image, projectLimit }
}

export async function requireUser(): Promise<SessionUser> {
  return (await currentUser()) ?? redirect('/')
}
