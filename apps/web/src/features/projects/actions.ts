'use server'

import { generateSiteKey } from '@copper/core'
import { schema } from '@copper/db'
import { and, eq } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { invalidateProject } from '@/lib/buffer'
import { ownerTag, projectTag } from '@/lib/cache'
import { db } from '@/lib/db'
import { countProjects } from './queries'
import { parseProjectInput } from './validate'

const { project } = schema

/** Drops every cached copy of a project: the dashboard's and the ingest side's. */
async function projectChanged(ownerId: string, siteKey: string): Promise<void> {
  updateTag(ownerTag(ownerId))
  updateTag(projectTag(siteKey))
  await invalidateProject(siteKey)
}

export interface FormState {
  error?: string
  saved?: boolean
  /** What was submitted, so the form keeps it after React resets the fields. */
  values?: { name: string; domains: string; timezone: string; isPublic: boolean }
}

const submitted = (form: FormData): FormState['values'] => ({
  name: String(form.get('name') ?? ''),
  domains: String(form.get('domains') ?? ''),
  timezone: String(form.get('timezone') ?? ''),
  isPublic: form.get('isPublic') === 'on',
})

export async function createProject(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser()
  const input = parseProjectInput(form)
  if (!input.ok) return { error: input.error, values: submitted(form) }
  if ((await countProjects(user.id)) >= user.projectLimit) {
    return {
      error: `This account is limited to ${user.projectLimit} projects. Delete one to add another.`,
      values: submitted(form),
    }
  }
  const siteKey = generateSiteKey()
  await db()
    .insert(project)
    .values({ ...input.value, siteKey, ownerId: user.id })
  await projectChanged(user.id, siteKey)
  redirect(`/p/${siteKey}/settings?created=1`)
}

export async function updateProject(
  siteKey: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const user = await requireUser()
  const input = parseProjectInput(form)
  if (!input.ok) return { error: input.error, values: submitted(form) }
  await db()
    .update(project)
    .set({ ...input.value, isPublic: form.get('isPublic') === 'on' })
    .where(and(eq(project.ownerId, user.id), eq(project.siteKey, siteKey)))
  await projectChanged(user.id, siteKey)
  return { saved: true, values: submitted(form) }
}

export async function deleteProject(siteKey: string): Promise<void> {
  const user = await requireUser()
  await db()
    .delete(project)
    .where(and(eq(project.ownerId, user.id), eq(project.siteKey, siteKey)))
  await projectChanged(user.id, siteKey)
  redirect('/dashboard')
}
