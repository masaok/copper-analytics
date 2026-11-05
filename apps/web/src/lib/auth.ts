import 'server-only'
import { schema } from '@copper/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { genericOAuth } from 'better-auth/plugins'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { isAdmin } from '@/features/admin/access'
import { db } from './db'
import { env } from './env'

function createAuth() {
  const config = env()
  return betterAuth({
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: config.trustedOrigins,
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
    plugins: [
      ...(config.justauth
        ? [
            genericOAuth({
              config: [
                {
                  providerId: 'justauth',
                  clientId: config.justauth.clientId,
                  clientSecret: config.justauth.clientSecret,
                  authorizationUrl: `${config.justauth.url}/oauth/authorize`,
                  tokenUrl: `${config.justauth.url}/oauth/token`,
                  userInfoUrl: `${config.justauth.url}/oauth/userinfo`,
                  scopes: ['profile', 'email'],
                  // Lets sign-in finish on another host that proxies /api/auth, such as the marketing site.
                  redirectURI: config.justauth.redirectURI,
                  // JustAuth's userinfo names the user `sub`, not `id`, without being an OIDC provider.
                  accountSubject: ({ profile }) => String(profile.sub),
                  // JustAuth only returns an email it has verified with GitHub or Google.
                  mapProfileToUser: (profile) => ({ emailVerified: Boolean(profile.email) }),
                },
              ],
            }),
          ]
        : []),
      nextCookies(),
    ],
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
  /** May open /admin: the verified owner of ADMIN_EMAIL. */
  admin: boolean
}

export async function currentUser(): Promise<SessionUser | null> {
  // Reading the request first marks the route dynamic, so a build never reaches the config check.
  const requestHeaders = await headers()
  const session = await auth().api.getSession({ headers: requestHeaders })
  if (!session) return null
  const { id, name, email, emailVerified, image } = session.user
  const projectLimit = (session.user as { projectLimit?: number }).projectLimit ?? 10
  const admin = isAdmin({ email, emailVerified }, env().adminEmail)
  return { id, name, email, image, projectLimit, admin }
}

export async function requireUser(): Promise<SessionUser> {
  return (await currentUser()) ?? redirect('/')
}

/** Everyone but the admin gets a 404, so the page does not reveal that it exists. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  return user.admin ? user : notFound()
}
