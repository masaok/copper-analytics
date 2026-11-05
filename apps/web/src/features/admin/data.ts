import 'server-only'
import { addDays } from '@copper/core'
import { schema } from '@copper/db'
import { count, desc, eq, gte, sql, sum } from 'drizzle-orm'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

const { user, account, project, statsDaily } = schema

// Drizzle prints a lone table's columns unqualified, so inside a subquery `id` would mean the
// subquery's table. The outer user's id is named in full.
const userId = sql`${user}.${sql.identifier('id')}`

/** Sitewide totals. Checks the caller itself, so no page can show these by forgetting to. */
export async function loadAdminTotals() {
  await requireAdmin()
  const today = new Date().toISOString().slice(0, 10)
  const [[users], [newUsers], [projects], [disabled], [yesterday], [month]] = await Promise.all([
    db().select({ n: count() }).from(user),
    db()
      .select({ n: count() })
      .from(user)
      .where(gte(user.createdAt, new Date(Date.now() - 30 * 86_400_000))),
    db().select({ n: count() }).from(project),
    db().select({ n: count() }).from(project).where(eq(project.disabled, true)),
    db()
      .select({ pageviews: sum(statsDaily.pageviews) })
      .from(statsDaily)
      .where(eq(statsDaily.day, addDays(today, -1))),
    db()
      .select({ pageviews: sum(statsDaily.pageviews) })
      .from(statsDaily)
      .where(gte(statsDaily.day, addDays(today, -30))),
  ])
  return {
    users: users?.n ?? 0,
    newUsers: newUsers?.n ?? 0,
    projects: projects?.n ?? 0,
    disabledProjects: disabled?.n ?? 0,
    pageviewsYesterday: Number(yesterday?.pageviews ?? 0),
    pageviews30d: Number(month?.pageviews ?? 0),
  }
}

/** Every account, newest first, with how it signs in and how many projects it has. */
export async function loadAdminUsers() {
  await requireAdmin()
  return db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      projectLimit: user.projectLimit,
      projects: sql<number>`(select count(*)::int from ${project} where ${project.ownerId} = ${userId})`,
      providers: sql<
        string[]
      >`coalesce((select array_agg(distinct ${account.providerId}) from ${account} where ${account.userId} = ${userId}), '{}')`,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
}
