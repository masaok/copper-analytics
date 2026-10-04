import { hasBearer } from '@copper/core'
import { ownersOf } from '@copper/db'
import { revalidateTag } from 'next/cache'
import { ownerTag, projectTag } from '@/lib/cache'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

/** Called by the ingest Worker after a flush, with the site keys that have new data. */
export async function POST(request: Request) {
  if (!hasBearer(request, env().revalidateSecret)) {
    return new Response('Unauthorized', { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as { siteKeys?: unknown } | null
  const siteKeys = Array.isArray(body?.siteKeys)
    ? body.siteKeys.filter((k): k is string => typeof k === 'string').slice(0, 2000)
    : []
  // Expire at once: the next view should show the hour that was just written.
  for (const key of siteKeys) revalidateTag(projectTag(key), { expire: 0 })
  const owners = await ownersOf(db(), siteKeys)
  for (const owner of owners) revalidateTag(ownerTag(owner), { expire: 0 })
  return Response.json({ revalidated: siteKeys.length, owners: owners.length })
}
