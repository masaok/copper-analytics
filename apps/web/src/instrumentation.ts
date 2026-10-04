/** Starts the simple-mode flush timer when the server boots, so buffered pageviews are written even if no more arrive. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.COPPER_MODE === 'edge') return
  if (!process.env.DATABASE_URL) return
  const { ensureFlusher } = await import('./lib/buffer')
  ensureFlusher()
}
