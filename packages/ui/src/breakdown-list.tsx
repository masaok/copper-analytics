import { formatNumber } from './format'

export interface BreakdownRow {
  key: string
  pageviews: number
  visitors: number
}

/** A ranked list where each row's bar is its share of the largest row. */
export function BreakdownList({
  rows,
  keyLabel,
  empty = 'Nothing recorded in this period.',
}: {
  rows: BreakdownRow[]
  keyLabel: string
  empty?: string
}) {
  if (rows.length === 0) return <p className="py-6 text-sm text-muted">{empty}</p>
  const max = Math.max(...rows.map((r) => r.visitors), 1)
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="pb-2 font-normal">{keyLabel}</th>
          <th className="pb-2 text-right font-normal">Visitors</th>
          <th className="hidden pb-2 pl-4 text-right font-normal sm:table-cell">Pageviews</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="relative py-1.5 pr-3">
              <span
                aria-hidden
                className="absolute inset-y-1 left-0 rounded-sm bg-copper-soft"
                style={{ width: `${Math.max((row.visitors / max) * 100, 1)}%` }}
              />
              <span className="relative block max-w-[16rem] truncate pl-2" title={row.key}>
                {row.key}
              </span>
            </td>
            <td className="tabular py-1.5 text-right font-medium">{formatNumber(row.visitors)}</td>
            <td className="tabular hidden py-1.5 pl-4 text-right text-muted sm:table-cell">
              {formatNumber(row.pageviews)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
