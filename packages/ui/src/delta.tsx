/** Percent change with an arrow, so direction never depends on color alone. */
export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-muted">no baseline</span>
  if (value === 0) return <span className="text-muted">no change</span>
  const up = value > 0
  const good = invert ? !up : up
  return (
    <span className={`tabular ${good ? 'text-patina' : 'text-danger'}`}>
      <span aria-hidden>{up ? '▲' : '▼'}</span> {Math.abs(value)}%
      <span className="sr-only">{up ? ' increase' : ' decrease'}</span>
    </span>
  )
}
