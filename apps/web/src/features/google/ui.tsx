import Link from 'next/link'
import { GOOGLE_RANGES, type GoogleRangeId, isGoogleRangeId } from './ranges'

type SearchParam = string | string[] | undefined
export const one = (value: SearchParam) => (Array.isArray(value) ? value[0] : value)

/** The `range` URL parameter, falling back to 28 days. */
export const rangeParam = (value: SearchParam): GoogleRangeId => {
  const range = one(value)
  return isGoogleRangeId(range) ? range : '28d'
}

export const percent = (share: number) => `${(share * 100).toFixed(1)}%`

/** `2026-11-03` as `Nov 3`. */
export const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

export function RangeNav({
  range,
  href,
}: {
  range: GoogleRangeId
  href: (range: GoogleRangeId) => string
}) {
  return (
    <nav aria-label="Range" className="flex gap-1 text-sm">
      {(Object.keys(GOOGLE_RANGES) as GoogleRangeId[]).map((id) => (
        <Link
          key={id}
          href={href(id)}
          aria-current={id === range ? 'page' : undefined}
          className={`rounded-md px-2.5 py-1 ${
            id === range ? 'bg-surface font-medium text-ink' : 'text-muted hover:text-ink'
          }`}
        >
          {id === '3m' ? '3 months' : `${id.slice(0, -1)} days`}
        </Link>
      ))}
    </nav>
  )
}

/**
 * A ranked list where each row's bar is its share of the largest `bar` value. The first value
 * column is emphasized; columns after the second hide on small screens.
 */
export function RankedTable({
  keyLabel,
  columns,
  rows,
  empty,
}: {
  keyLabel: string
  columns: string[]
  rows: { key: string; bar: number; values: string[] }[]
  empty: string
}) {
  if (rows.length === 0) return <p className="py-6 text-sm text-muted">{empty}</p>
  const max = Math.max(...rows.map((r) => r.bar), 1)
  const cell = (i: number) =>
    `tabular py-1.5 text-right ${i === 0 ? 'font-medium' : 'pl-4 text-muted'} ${i > 1 ? 'hidden sm:table-cell' : ''}`
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-muted">
          <th className="pb-2 font-normal">{keyLabel}</th>
          {columns.map((label, i) => (
            <th
              key={label}
              className={`pb-2 text-right font-normal ${i > 0 ? 'pl-4' : ''} ${i > 1 ? 'hidden sm:table-cell' : ''}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td className="relative py-1.5 pr-3">
              <span
                aria-hidden
                className="absolute inset-y-1 left-0 rounded-sm bg-copper-soft"
                style={{ width: `${Math.max((row.bar / max) * 100, 1)}%` }}
              />
              <span className="relative block max-w-[18rem] truncate pl-2" title={row.key}>
                {row.key}
              </span>
            </td>
            {row.values.map((value, i) => (
              <td key={columns[i]} className={cell(i)}>
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
