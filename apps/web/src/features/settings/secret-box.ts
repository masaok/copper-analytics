import 'server-only'
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

/** A 256-bit key for stored credentials, separate from the one that signs cookies. */
const keyFrom = (secret: string): Buffer =>
  Buffer.from(hkdfSync('sha256', secret, 'copper', 'stored-credentials-v1', 32))

/** Encrypts with AES-256-GCM. The result is `iv.tag.ciphertext`, each base64url. */
export function seal(plain: string, secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.')
}

/** Decrypts what `seal` made. Throws when the secret changed or the value was tampered with. */
export function unseal(sealed: string, secret: string): string {
  const [iv, tag, data] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'))
  if (!iv || !tag || !data) throw new Error('Malformed sealed value.')
  const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
