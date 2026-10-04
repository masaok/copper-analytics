/** The four numbers a report leads with. The KPI cards, the chart and the URL parameter share this list. */
export const METRICS = [
  { id: 'visitors', label: 'Visitors' },
  { id: 'pageviews', label: 'Pageviews' },
  { id: 'visits', label: 'Visits' },
  { id: 'bounce', label: 'Bounce rate' },
] as const
export type MetricId = (typeof METRICS)[number]['id']
export const isMetricId = (value: unknown): value is MetricId => METRICS.some((m) => m.id === value)
