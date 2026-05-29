import crypto from 'node:crypto'

const SIGNATURE_TTL_MS = 5 * 60 * 1000

export function verifySignature(
  payload: string,
  signatureHeader: string | null | undefined,
  secret: string = 'default_webhook_secret'
): { valid: boolean; expired: boolean } {
  if (!signatureHeader) {
    return { valid: false, expired: false }
  }

  const match = signatureHeader.match(/^sha256=(.+),t=(\d+)$/)
  if (!match) {
    const simpleMatch = signatureHeader.match(/^sha256=(.+)$/)
    if (simpleMatch) {
      const sig = simpleMatch[1]
      const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
      return { valid: sig === expected, expired: false }
    }
    return { valid: false, expired: false }
  }

  const sig = match[1]
  const timestamp = parseInt(match[2], 10)
  const now = Date.now()
  const expired = now - timestamp > SIGNATURE_TTL_MS

  const signedPayload = `${timestamp}.${payload}`
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
  const valid = sig === expected && !expired

  return { valid, expired }
}
