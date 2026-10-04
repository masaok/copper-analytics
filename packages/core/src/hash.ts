/** Shards are fixed at 16. Changing this strands unflushed data in the old shards. */
export const SHARD_COUNT = 16

/** FNV-1a. Stable across runtimes, which is all shard routing needs. */
export function shardOf(siteKey: string, shards = SHARD_COUNT): number {
  let h = 0x811c9dc5
  for (let i = 0; i < siteKey.length; i++) {
    h ^= siteKey.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) % shards
}

/** First 8 bytes of SHA-256(salt + site key + ip + user agent), hex. The inputs are never stored. */
export async function visitorId(
  salt: string,
  siteKey: string,
  ip: string,
  userAgent: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${siteKey}|${ip}|${userAgent}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  let hex = ''
  for (let i = 0; i < 8; i++) hex += (digest[i] as number).toString(16).padStart(2, '0')
  return hex
}

export function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const SITE_KEY_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
export const SITE_KEY_LENGTH = 10
export const SITE_KEY_PATTERN = /^[0-9a-z]{10}$/

/** Public 10-character project key. 36^10 values, rejection-sampled so every character is uniform. */
export function generateSiteKey(): string {
  let key = ''
  while (key.length < SITE_KEY_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(SITE_KEY_LENGTH * 2))) {
      if (byte < 252 && key.length < SITE_KEY_LENGTH) key += SITE_KEY_ALPHABET[byte % 36]
    }
  }
  return key
}
