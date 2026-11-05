import 'server-only'
import { schema } from '@copper/db'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { type DomainList, fetchNamecheapDomains } from './namecheap'
import { unseal } from './secret-box'

const { account, namecheapCredential } = schema

/** The sign-in methods linked to an account, such as `github` and `justauth`. */
export async function signInMethods(userId: string): Promise<string[]> {
  const rows = await db()
    .selectDistinct({ provider: account.providerId })
    .from(account)
    .where(eq(account.userId, userId))
  return rows.map((r) => r.provider).sort()
}

/** What the settings page may show about the stored key. Never the key itself. */
export async function namecheapSummary(userId: string) {
  const [row] = await db()
    .select({
      apiUser: namecheapCredential.apiUser,
      last4: namecheapCredential.apiKeyLast4,
      updatedAt: namecheapCredential.updatedAt,
    })
    .from(namecheapCredential)
    .where(eq(namecheapCredential.userId, userId))
    .limit(1)
  return row ?? null
}

/**
 * The user's Namecheap domains, fetched now with their stored key, calling from `clientIp`
 * (see `outboundIp`). Null when no key is stored.
 */
export async function namecheapDomains(
  userId: string,
  clientIp: string | null,
): Promise<DomainList | null> {
  const [row] = await db()
    .select()
    .from(namecheapCredential)
    .where(eq(namecheapCredential.userId, userId))
    .limit(1)
  if (!row) return null
  if (!clientIp) return { ok: false, error: "Could not find this server's IP address." }
  let apiKey: string
  try {
    apiKey = unseal(row.apiKeyEncrypted, env().BETTER_AUTH_SECRET)
  } catch {
    return { ok: false, error: 'The stored key can no longer be read. Save it again.' }
  }
  return fetchNamecheapDomains({ apiUser: row.apiUser, apiKey }, clientIp)
}
