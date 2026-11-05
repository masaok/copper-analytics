'use server'

import { schema } from '@copper/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { parseNamecheapInput } from './namecheap'
import { seal } from './secret-box'

const { namecheapCredential } = schema
const PAGE = '/dashboard/settings/namecheap'

export interface NamecheapFormState {
  error?: string
  apiUser?: string
}

/** Encrypts and stores the key, replacing any earlier one. The key is never sent back. */
export async function saveNamecheap(
  _prev: NamecheapFormState,
  form: FormData,
): Promise<NamecheapFormState> {
  const user = await requireUser()
  const apiUser = String(form.get('apiUser') ?? '')
  const input = parseNamecheapInput(apiUser, String(form.get('apiKey') ?? ''))
  if ('error' in input) return { error: input.error, apiUser }
  const values = {
    apiUser: input.apiUser,
    apiKeyEncrypted: seal(input.apiKey, env().BETTER_AUTH_SECRET),
    apiKeyLast4: input.apiKey.slice(-4),
    updatedAt: new Date(),
  }
  await db()
    .insert(namecheapCredential)
    .values({ userId: user.id, ...values })
    .onConflictDoUpdate({ target: namecheapCredential.userId, set: values })
  redirect(PAGE)
}

export async function deleteNamecheap(): Promise<void> {
  const user = await requireUser()
  await db().delete(namecheapCredential).where(eq(namecheapCredential.userId, user.id))
  redirect(PAGE)
}
