import 'server-only'
import { schema } from '@copper/db'
import { and, asc, count, eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { ownerTag, projectTag } from '@/lib/cache'
import { db } from '@/lib/db'

const { project } = schema
export type Project = typeof project.$inferSelect

export const listProjects = (ownerId: string): Promise<Project[]> =>
  db().select().from(project).where(eq(project.ownerId, ownerId)).orderBy(asc(project.name))

export async function countProjects(ownerId: string): Promise<number> {
  const [row] = await db().select({ n: count() }).from(project).where(eq(project.ownerId, ownerId))
  return row?.n ?? 0
}

export async function getOwnedProject(ownerId: string, siteKey: string): Promise<Project | null> {
  const [row] = await db()
    .select()
    .from(project)
    .where(and(eq(project.ownerId, ownerId), eq(project.siteKey, siteKey)))
    .limit(1)
  return row ?? null
}

/** The fields the dashboard needs. Plain values only, so it survives the cache's serialization. */
export interface ProjectSummary {
  id: number
  siteKey: string
  ownerId: string
  name: string
  domains: string[]
  timezone: string
  isPublic: boolean
}

const summaryColumns = {
  id: project.id,
  siteKey: project.siteKey,
  ownerId: project.ownerId,
  name: project.name,
  domains: project.domains,
  timezone: project.timezone,
  isPublic: project.isPublic,
}

/** A user's projects, cached until one of them is created, changed or deleted. */
export const cachedProjects = (ownerId: string): Promise<ProjectSummary[]> =>
  unstable_cache(
    () =>
      db()
        .select(summaryColumns)
        .from(project)
        .where(eq(project.ownerId, ownerId))
        .orderBy(asc(project.name)),
    ['projects', ownerId],
    { tags: [ownerTag(ownerId)] },
  )()

/** One project by its public key, cached until it changes. Callers check ownership or `isPublic`. */
export const cachedProject = (siteKey: string): Promise<ProjectSummary | null> =>
  unstable_cache(
    async () => {
      const [row] = await db()
        .select(summaryColumns)
        .from(project)
        .where(eq(project.siteKey, siteKey))
        .limit(1)
      return row ?? null
    },
    ['project', siteKey],
    { tags: [projectTag(siteKey)] },
  )()

/** SHA-256 of the project's stats API token, or null. Cached so API calls do not query the database. */
export const cachedTokenHash = (siteKey: string): Promise<string | null> =>
  unstable_cache(
    async () => {
      const [row] = await db()
        .select({ hash: project.apiTokenHash })
        .from(project)
        .where(eq(project.siteKey, siteKey))
        .limit(1)
      return row?.hash ?? null
    },
    ['token', siteKey],
    { tags: [projectTag(siteKey)] },
  )()
