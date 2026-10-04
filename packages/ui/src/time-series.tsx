'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNumber } from './format'

export interface ChartPoint {
  /** Axis tick. */
  label: string
  /** Full label for the tooltip and the table view. */
  title: string
  value: number
}

function ChartTooltip({
  active,
  payload,
  metric,
  suffix,
}: {
  active?: boolean
  payload?: { payload: ChartPoint }[]
  metric: string
  suffix: string
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-md border border-line bg-bg px-3 py-2 text-sm shadow-sm">
      <div className="text-muted">{point.title}</div>
      <div className="tabular font-medium">
        {formatNumber(point.value)}
        {suffix} {metric.toLowerCase()}
      </div>
    </div>
  )
}

/** One series over time. A single series needs no legend; the heading above names it. */
export function TimeSeriesChart({
  points,
  metric,
  suffix = '',
}: {
  points: ChartPoint[]
  metric: string
  suffix?: string
}) {
  return (
    <figure>
      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="copper-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--chart)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              minTickGap={32}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickFormatter={(v: number) => `${formatNumber(v)}${suffix}`}
            />
            <Tooltip
              cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }}
              content={<ChartTooltip metric={metric} suffix={suffix} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--chart)"
              strokeWidth={2}
              fill="url(#copper-fill)"
              activeDot={{ r: 4, stroke: 'var(--bg)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Show as a table</summary>
        <table className="mt-2 w-full max-w-sm text-left">
          <thead>
            <tr className="text-muted">
              <th className="py-1 font-normal">Period</th>
              <th className="py-1 text-right font-normal">{metric}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.title} className="border-t border-line">
                <td className="py-1">{p.title}</td>
                <td className="tabular py-1 text-right">
                  {formatNumber(p.value)}
                  {suffix}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
