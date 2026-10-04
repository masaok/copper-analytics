import { isValidTimeZone } from '@copper/core'

export const MAX_DOMAINS = 10

export interface ProjectInput {
  name: string
  domains: string[]
  timezone: string
}

/** `https://www.Acme.io/pricing` becomes `acme.io`. Returns null for anything that is not a hostname. */
export function normalizeDomain(raw: string): string | null {
  const host = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(host) ||
    host === 'localhost'
    ? host
    : null
}

export function parseProjectInput(
  form: FormData,
): { ok: true; value: ProjectInput } | { ok: false; error: string } {
  const name = String(form.get('name') ?? '').trim()
  if (name.length < 1 || name.length > 60) {
    return { ok: false, error: 'Give the project a name of 1 to 60 characters.' }
  }
  const rawDomains = String(form.get('domains') ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
  if (rawDomains.length > MAX_DOMAINS) {
    return { ok: false, error: `A project can list at most ${MAX_DOMAINS} domains.` }
  }
  const domains: string[] = []
  for (const raw of rawDomains) {
    const domain = normalizeDomain(raw)
    if (!domain) return { ok: false, error: `"${raw}" is not a domain. Use a form like acme.io.` }
    if (!domains.includes(domain)) domains.push(domain)
  }
  const timezone = String(form.get('timezone') ?? 'UTC').trim() || 'UTC'
  if (!isValidTimeZone(timezone)) {
    return { ok: false, error: `"${timezone}" is not a timezone. Use a form like Europe/Berlin.` }
  }
  return { ok: true, value: { name, domains, timezone } }
}
