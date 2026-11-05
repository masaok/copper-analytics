import 'server-only'
import { schema } from '@copper/db'
import { eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { type DomainList, fetchNamecheapDomains, maskKey, outboundIp } from './namecheap'
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

/** What the settings page may show about the stored key: a masked copy, never the key itself. */
export async function namecheapSummary(userId: string) {
  const [row] = await db()
    .select()
    .from(namecheapCredential)
    .where(eq(namecheapCredential.userId, userId))
    .limit(1)
  if (!row) return null
  let masked: string
  try {
    masked = maskKey(unseal(row.apiKeyEncrypted, env().BETTER_AUTH_SECRET))
  } catch {
    // Sealed under another secret. The last four characters are stored in the clear for this.
    masked = `${'•'.repeat(12)}${row.apiKeyLast4}`
  }
  return { apiUser: row.apiUser, masked, updatedAt: row.updatedAt }
}

/** A failure to show, thrown so the cache keeps only lists that loaded. */
class NotCached extends Error {}

/**
 * The user's Namecheap domains, fetched with their stored key and kept for five minutes, since
 * each load pages through the whole account. Null when no key is stored.
 */
export async function namecheapDomains(userId: string): Promise<DomainList | null> {
  const [row] = await db()
    .select()
    .from(namecheapCredential)
    .where(eq(namecheapCredential.userId, userId))
    .limit(1)
  if (!row) return null
  let apiKey: string
  try {
    apiKey = unseal(row.apiKeyEncrypted, env().BETTER_AUTH_SECRET)
  } catch {
    return { ok: false, error: 'The stored key can no longer be read. Save it again.' }
  }
  try {
    // The key stays in the closure: unstable_cache puts a function's arguments in its cache key.
    // Saving a key changes `updatedAt`, so a new key never reads the old key's list.
    return await unstable_cache(
      async () => {
        const clientIp = await outboundIp()
        if (!clientIp) throw new NotCached("Could not find this server's IP address.")
        const list = await fetchNamecheapDomains({ apiUser: row.apiUser, apiKey }, clientIp)
        if (!list.ok) throw new NotCached(list.error)
        return list
      },
      ['namecheap-domains', userId, row.updatedAt.toISOString()],
      { revalidate: 300 },
    )()
  } catch (error) {
    if (error instanceof NotCached) return { ok: false, error: error.message }
    throw error
  }
}
