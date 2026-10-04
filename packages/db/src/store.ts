import {
  addDays,
  addMonths,
  type Breakdown,
  DAILY_TOP_N,
  type DailyReport,
  type FlushResult,
  type FlushUnit,
  localDay,
  MONTHLY_TOP_N,
  mergeBreakdown,
  monthOf,
  type ProjectConfig,
  type Store,
  truncateBreakdown,
} from '@copper/core'
import { and, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import type { Db } from './db'
import { RETENTION } from './retention'
import {
  breakdownDaily,
  breakdownMonthly,
  dbSizeLog,
  flushLog,
  project,
  statsDaily,
  statsHourly,
} from './schema'

interface CounterRow {
  projectId: number
  pageviews: number
  visitors: number
  visits: number
  bounces: number
}

const rowCount = (result: unknown): number =>
  (result as { rowCount?: number | null; affectedRows?: number }).rowCount ??
  (result as { affectedRows?: number }).affectedRows ??
  0

export class PgStore implements Store {
  constructor(private readonly db: Db) {}

  async projectConfig(siteKey: string): Promise<ProjectConfig | null> {
    const [row] = await this.db
      .select({
        siteKey: project.siteKey,
        domains: project.domains,
        dailyCap: project.dailyCap,
        disabled: project.disabled,
      })
      .from(project)
      .where(eq(project.siteKey, siteKey))
      .limit(1)
    if (!row || row.disabled) return null
    return { siteKey: row.siteKey, domains: row.domains, dailyCap: row.dailyCap }
  }

  async applyFlush(shard: number, units: FlushUnit[]): Promise<FlushResult> {
    const result: FlushResult = { applied: [], skipped: [] }
    if (units.length === 0) return result

    await this.db.transaction(async (tx) => {
      const siteKeys = [...new Set(units.flatMap((u) => u.projects.map((p) => p.siteKey)))]
      const known = new Map(
        siteKeys.length === 0
          ? []
          : (
              await tx
                .select({ id: project.id, siteKey: project.siteKey, timezone: project.timezone })
                .from(project)
                .where(inArray(project.siteKey, siteKeys))
            ).map((p) => [p.siteKey, p]),
      )

      // Several units can touch the same row, and one statement may not update a row twice.
      const hourly = new Map<string, CounterRow & { hour: Date }>()
      const daily = new Map<string, CounterRow & { day: string }>()
      const breakdowns = new Map<string, { projectId: number; day: string; data: Breakdown }>()

      for (const unit of units) {
        const inserted = await tx
          .insert(flushLog)
          .values({ shard, flushId: unit.flushId })
          .onConflictDoNothing()
          .returning({ flushId: flushLog.flushId })
        if (inserted.length === 0) {
          result.skipped.push(unit.flushId)
          continue
        }
        result.applied.push(unit.flushId)

        const hour = new Date(unit.hour)
        for (const delta of unit.projects) {
          const target = known.get(delta.siteKey)
          if (!target) continue
          const day = localDay(hour.getTime(), target.timezone)

          const hourKey = `${target.id}|${unit.hour}`
          const h = hourly.get(hourKey) ?? {
            projectId: target.id,
            hour,
            pageviews: 0,
            visitors: 0,
            visits: 0,
            bounces: 0,
          }
          hourly.set(hourKey, h)
          h.pageviews += delta.pageviews
          h.visitors += delta.visitors
          h.visits += delta.visits
          h.bounces += delta.bounces

          const dayKey = `${target.id}|${day}`
          const d = daily.get(dayKey) ?? {
            projectId: target.id,
            day,
            pageviews: 0,
            visitors: 0,
            visits: 0,
            bounces: 0,
          }
          daily.set(dayKey, d)
          d.pageviews += delta.pageviews
          d.visitors += delta.dayVisitors
          d.visits += delta.visits
          d.bounces += delta.bounces

          const b = breakdowns.get(dayKey) ?? { projectId: target.id, day, data: {} }
          breakdowns.set(dayKey, b)
          mergeBreakdown(b.data, delta.breakdown)
        }
      }

      if (hourly.size > 0) {
        await tx
          .insert(statsHourly)
          .values([...hourly.values()])
          .onConflictDoUpdate({
            target: [statsHourly.projectId, statsHourly.hour],
            set: {
              pageviews: sql`${statsHourly.pageviews} + excluded.pageviews`,
              visitors: sql`${statsHourly.visitors} + excluded.visitors`,
              visits: sql`${statsHourly.visits} + excluded.visits`,
              bounces: sql`${statsHourly.bounces} + excluded.bounces`,
            },
          })
      }
      if (daily.size > 0) {
        await tx
          .insert(statsDaily)
          .values([...daily.values()])
          .onConflictDoUpdate({
            target: [statsDaily.projectId, statsDaily.day],
            set: {
              pageviews: sql`${statsDaily.pageviews} + excluded.pageviews`,
              visitors: sql`${statsDaily.visitors} + excluded.visitors`,
              visits: sql`${statsDaily.visits} + excluded.visits`,
              bounces: sql`${statsDaily.bounces} + excluded.bounces`,
            },
          })
      }
      if (breakdowns.size > 0) {
        const targets = [...breakdowns.values()]
        const days = [...new Set(targets.map((t) => t.day))]
        const existing = await tx
          .select()
          .from(breakdownDaily)
          .where(
            and(
              inArray(breakdownDaily.projectId, [...new Set(targets.map((t) => t.projectId))]),
              inArray(breakdownDaily.day, days),
            ),
          )
          .for('update')
        for (const row of existing) {
          const target = breakdowns.get(`${row.projectId}|${row.day}`)
          if (target) mergeBreakdown(target.data, row.data)
        }
        await tx
          .insert(breakdownDaily)
          .values(targets.map((t) => ({ ...t, data: truncateBreakdown(t.data, DAILY_TOP_N) })))
          .onConflictDoUpdate({
            target: [breakdownDaily.projectId, breakdownDaily.day],
            set: { data: sql`excluded.data` },
          })
      }
    })
    return result
  }

  async runDaily(now: Date): Promise<DailyReport> {
    const today = now.toISOString().slice(0, 10)
    // A month is finished once yesterday (UTC) is past it, whatever a project's timezone.
    const openMonth = monthOf(addDays(today, -1))

    const monthsRolled = await this.rollUpMonths(openMonth)

    const hourlyCutoff = new Date(now.getTime() - RETENTION.statsHourlyDays * 86_400_000)
    const flushCutoff = new Date(now.getTime() - RETENTION.flushLogDays * 86_400_000)
    const deleted = {
      statsHourly: rowCount(
        await this.db.delete(statsHourly).where(lt(statsHourly.hour, hourlyCutoff)),
      ),
      breakdownDaily: rowCount(
        await this.db
          .delete(breakdownDaily)
          .where(lt(breakdownDaily.day, addDays(today, -RETENTION.breakdownDailyDays))),
      ),
      breakdownMonthly: rowCount(
        await this.db
          .delete(breakdownMonthly)
          .where(
            lt(
              breakdownMonthly.month,
              addMonths(monthOf(today), -RETENTION.breakdownMonthlyMonths),
            ),
          ),
      ),
      flushLog: rowCount(await this.db.delete(flushLog).where(lt(flushLog.flushedAt, flushCutoff))),
    }

    const sizeResult = await this.db.execute(
      sql`select pg_database_size(current_database())::bigint as bytes`,
    )
    const databaseBytes = Number(
      (sizeResult as unknown as { rows: { bytes: string }[] }).rows[0]?.bytes,
    )
    await this.db
      .insert(dbSizeLog)
      .values({ day: today, bytes: databaseBytes })
      .onConflictDoUpdate({
        target: dbSizeLog.day,
        set: { bytes: databaseBytes, recordedAt: now },
      })

    return { day: today, deleted, monthsRolled, databaseBytes }
  }

  /** Builds `breakdown_monthly` for every finished month that has daily rows and no monthly row yet. */
  private async rollUpMonths(openMonth: string): Promise<number> {
    const month = sql<string>`date_trunc('month', ${breakdownDaily.day})::date`
    const missing = await this.db
      .selectDistinct({ projectId: breakdownDaily.projectId, month })
      .from(breakdownDaily)
      .leftJoin(
        breakdownMonthly,
        and(
          eq(breakdownMonthly.projectId, breakdownDaily.projectId),
          eq(breakdownMonthly.month, month),
        ),
      )
      .where(and(lt(breakdownDaily.day, openMonth), sql`${breakdownMonthly.projectId} is null`))

    for (const target of missing) {
      const monthStart = String(target.month).slice(0, 10)
      const days = await this.db
        .select({ data: breakdownDaily.data })
        .from(breakdownDaily)
        .where(
          and(
            eq(breakdownDaily.projectId, target.projectId),
            gte(breakdownDaily.day, monthStart),
            lt(breakdownDaily.day, addMonths(monthStart, 1)),
          ),
        )
      const data = days.reduce<Breakdown>((acc, d) => mergeBreakdown(acc, d.data), {})
      await this.db
        .insert(breakdownMonthly)
        .values({
          projectId: target.projectId,
          month: monthStart,
          data: truncateBreakdown(data, MONTHLY_TOP_N),
        })
        .onConflictDoNothing()
    }
    return missing.length
  }
}
