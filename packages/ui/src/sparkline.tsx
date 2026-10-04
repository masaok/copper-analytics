/** A small trend line with no axes. The last point is marked because it is the one being compared. */
export function Sparkline({
  values,
  label,
  width = 132,
  height = 30,
}: {
  values: number[]
  label: string
  width?: number
  height?: number
}) {
  const max = Math.max(...values, 1)
  const pad = 3
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  const points = values.map((v, i) => [
    pad + i * step,
    height - pad - (v / max) * (height - pad * 2),
  ]) as [number, number][]
  const last = points[points.length - 1]
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <polyline
        points={points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke="var(--chart)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last ? <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--chart)" /> : null}
    </svg>
  )
}
