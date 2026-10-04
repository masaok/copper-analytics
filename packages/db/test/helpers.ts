import type { FlushUnit, ProjectHourDelta } from '@copper/core'
import type { Db } from '../src/db'
import { project, user } from '../src/schema'

export async function seedProject(
  db: Db,
  siteKey: string,
  over: Partial<typeof project.$inferInsert> = {},
): Promise<number> {
  await db
    .insert(user)
    .values({ id: 'u1', name: 'Test', email: 'test@example.com' })
    .onConflictDoNothing()
  const [row] = await db
    .insert(project)
    .values({ siteKey, ownerId: 'u1', name: siteKey, ...over })
    .returning({ id: project.id })
  return (row as { id: number }).id
}

export const delta = (siteKey: string, over: Partial<ProjectHourDelta> = {}): ProjectHourDelta => ({
  siteKey,
  pageviews: 10,
  visitors: 4,
  dayVisitors: 3,
  visits: 5,
  bounces: 2,
  breakdown: { page: { '/': [7, 3], '/pricing': [3, 2] }, country: { US: [10, 3] } },
  ...over,
})

export const unit = (hour: string, projects: ProjectHourDelta[], flushId = hour): FlushUnit => ({
  flushId,
  hour,
  projects,
})
