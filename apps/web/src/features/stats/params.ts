import { isRangeId, type RangeId } from '@copper/core'
import { isMetricId, type MetricId } from './metrics'

type SearchParams = Record<string, string | string[] | undefined>
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** Reads the report's URL parameters, falling back to the 30-day visitors view. */
export function reportParams(search: SearchParams): {
  range: RangeId
  metric: MetricId
  custom: { from?: string; to?: string }
} {
  const range = one(search.range)
  const metric = one(search.metric)
  return {
    range: isRangeId(range) ? range : '30d',
    metric: isMetricId(metric) ? metric : 'visitors',
    custom: { from: one(search.from), to: one(search.to) },
  }
}
