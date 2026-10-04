import 'server-only'
import { schema } from '@copper/db'
import { and, asc, count, eq } from 'drizzle-orm'
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

export async function getPublicProject(siteKey: string): Promise<Project | null> {
  const [row] = await db()
    .select()
    .from(project)
    .where(and(eq(project.siteKey, siteKey), eq(project.isPublic, true)))
    .limit(1)
  return row ?? null
}
