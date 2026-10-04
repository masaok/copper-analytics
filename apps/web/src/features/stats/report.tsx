import {
  bounceRate,
  type Counters,
  OTHER,
  percentChange,
  RANGES,
  type RangeId,
  topEntries,
} from '@copper/core'
import { BreakdownList, Delta, formatBucket, formatNumber, TimeSeriesChart } from '@copper/ui'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { inputClass } from '@/components/ui'
import type { ProjectSummary } from '@/features/projects/queries'
import type { Report } from './data'
import { DeviceTabs } from './device-tabs'
import { LiveCount } from './live-count'
import { METRICS, type MetricId } from './metrics'

const metricValue = (metric: MetricId, c: Counters): number =>
  metric === 'bounce' ? bounceRate(c.bounces, c.visits) : c[metric]

const COMPARED_WITH: Record<RangeId, string> = {
  today: 'vs yesterday',
  '24h': 'vs the 24 hours before',
  '7d': 'vs the 7 days before',
  '30d': 'vs the 30 days before',
  '12mo': 'vs the 12 months before',
  custom: 'vs the period before',
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
function countryName(code: string): string {
  try {
    return /^[A-Z]{2}$/.test(code) ? (regionNames.of(code) ?? code) : code
  } catch {
    return code
  }
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h2 className="mb-3 font-medium">{title}</h2>
      {children}
    </section>
  )
}

export function ProjectReport({
  project,
  report,
  metric,
  basePath,
}: {
  project: ProjectSummary
  report: Report
  metric: MetricId
  basePath: string
}) {
  const { range, totals, previous, series, breakdown } = report
  const href = (params: Record<string, string>) => {
    const query = new URLSearchParams({ range: range.id, metric, ...params })
    if (query.get('range') === 'custom') {
      query.set('from', params.from ?? range.current.from)
      query.set('to', params.to ?? range.current.to)
    }
    return `${basePath}?${query}`
  }
  const points = series.map((p) => ({
    label: formatBucket(range.grain, p.bucket, project.timezone),
    title: formatBucket(range.grain, p.bucket, project.timezone, true),
    value: metricValue(metric, p),
  }))
  // Ranked by visitors, the number the bars show, with the (other) bucket kept last.
  const rows = (dimension: Parameters<typeof topEntries>[1]) =>
    topEntries(breakdown, dimension, 10).sort(
      (a, b) => Number(a.key === OTHER) - Number(b.key === OTHER) || b.visitors - a.visitors,
    )
  const countries = rows('country').map((row) => ({ ...row, key: countryName(row.key) }))
  const selected = METRICS.find((m) => m.id === metric) ?? METRICS[0]
  const multiDay = range.grain !== 'hour' || range.id === '24h'

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted">{project.domains.join(', ') || 'Any domain'}</p>
        </div>
        <LiveCount siteKey={project.siteKey} initial={report.live} />
      </div>

      <nav aria-label="Date range" className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
        {RANGES.map((r) => (
          <Link
            key={r.id}
            href={href({ range: r.id })}
            aria-current={r.id === range.id ? 'page' : undefined}
            className={`rounded-md px-2.5 py-1 ${
              r.id === range.id
                ? 'bg-copper-soft font-medium text-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            {r.label}
          </Link>
        ))}
        {range.id === 'custom' ? (
          <form action={basePath} className="ml-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="range" value="custom" />
            <input type="hidden" name="metric" value={metric} />
            <label className="sr-only" htmlFor="from">
              From
            </label>
            <input
              id="from"
              type="date"
              name="from"
              defaultValue={range.current.from}
              className={`${inputClass} w-auto py-1`}
            />
            <span className="text-muted">to</span>
            <label className="sr-only" htmlFor="to">
              To
            </label>
            <input
              id="to"
              type="date"
              name="to"
              defaultValue={range.current.to}
              className={`${inputClass} w-auto py-1`}
            />
            <button
              type="submit"
              className="cursor-pointer rounded-md border border-line px-2.5 py-1 hover:bg-surface"
            >
              Apply
            </button>
          </form>
        ) : null}
      </nav>

      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        {METRICS.map((m) => {
          const now = metricValue(m.id, totals)
          const before = metricValue(m.id, previous)
          const change =
            m.id === 'bounce'
              ? previous.visits > 0
                ? now - before
                : null
              : percentChange(now, before)
          return (
            <Link
              key={m.id}
              href={href({ metric: m.id })}
              aria-current={m.id === metric ? 'true' : undefined}
              data-testid={`kpi-${m.id}`}
              className={`border-t-2 pt-3 ${m.id === metric ? 'border-copper' : 'border-line hover:border-muted'}`}
            >
              <div className="text-sm text-muted">{m.label}</div>
              <div className="tabular text-3xl font-semibold tracking-tight">
                {formatNumber(now)}
                {m.id === 'bounce' ? '%' : ''}
              </div>
              <div className="text-sm">
                {m.id === 'bounce' && change !== null ? (
                  <BouncePoints change={change} />
                ) : (
                  <Delta value={change} />
                )}
              </div>
            </Link>
          )
        })}
      </div>
      <p className="-mt-5 text-sm text-muted">
        Changes are {COMPARED_WITH[range.id]}.
        {multiDay ? ' Visitors over several days are the sum of each day’s unique visitors.' : ''}
      </p>

      <section aria-label={`${selected.label} over time`}>
        <h2 className="mb-3 font-medium">{selected.label}</h2>
        <TimeSeriesChart
          points={points}
          metric={selected.label}
          suffix={metric === 'bounce' ? '%' : ''}
        />
      </section>

      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        <Panel title="Top pages">
          <BreakdownList rows={rows('page')} keyLabel="Page" />
        </Panel>
        <Panel title="Referrers">
          <BreakdownList rows={rows('referrer')} keyLabel="Source" />
        </Panel>
        <Panel title="Countries">
          <BreakdownList rows={countries} keyLabel="Country" />
        </Panel>
        <Panel title="Devices">
          <DeviceTabs rows={{ device: rows('device'), browser: rows('browser'), os: rows('os') }} />
        </Panel>
        <Panel title="UTM sources">
          <BreakdownList
            rows={rows('utm_source')}
            keyLabel="utm_source"
            empty="No visits carried a utm_source tag in this period."
          />
        </Panel>
      </div>
    </div>
  )
}

/** Bounce rate changes in percentage points, and lower is better. */
function BouncePoints({ change }: { change: number }) {
  if (change === 0) return <span className="text-muted">no change</span>
  const down = change < 0
  return (
    <span className={`tabular ${down ? 'text-patina' : 'text-danger'}`}>
      <span aria-hidden>{down ? '▼' : '▲'}</span> {Math.abs(change)} pts
      <span className="sr-only">{down ? ' lower' : ' higher'}</span>
    </span>
  )
}
