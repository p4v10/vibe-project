import crypto from 'crypto'

const KEY_PREFIX = 'pg_live_'
const KEY_BYTES = 32

export function generateApiKey(): { raw: string; hash: string; prefix: string; lastFour: string } {
  const random = crypto.randomBytes(KEY_BYTES).toString('base64url')
  const raw = `${KEY_PREFIX}${random}`
  const hash = hashApiKey(raw)
  const prefix = raw.slice(0, KEY_PREFIX.length + 8)
  const lastFour = raw.slice(-4)
  return { raw, hash, prefix, lastFour }
}

export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}
