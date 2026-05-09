import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../database'

export interface IdempotencyInfo {
  requestId: string
  isRetry: boolean
  cachedResponse?: any
}

declare global {
  namespace Express {
    interface Request {
      idempotency: IdempotencyInfo
    }
  }
}

export function getEndpointKey(method: string, originalUrl: string): string {
  return `${method}:${originalUrl.split('?')[0]}`
}

export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const requestId = req.headers['x-request-id'] as string || uuidv4()
  req.idempotency = {
    requestId,
    isRetry: false
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    try {
      const endpoint = getEndpointKey(req.method, req.originalUrl)
      const cached = await db.get(
        'SELECT response FROM idempotent_requests WHERE request_id = ? AND endpoint = ? AND expires_at > ?',
        [requestId, endpoint, new Date().toISOString()]
      )

      if (cached && cached.response) {
        req.idempotency.isRetry = true
        req.idempotency.cachedResponse = JSON.parse(cached.response)
        next()
        return
      }
    } catch (error) {
      console.error('Error checking idempotency:', error)
    }
  }

  next()
}

export async function cacheIdempotentResponse(
  requestId: string,
  endpoint: string,
  response: any,
  ttlHours: number = 24
): Promise<void> {
  try {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000)

    await db.run(
      'INSERT INTO idempotent_requests (id, request_id, endpoint, response, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), requestId, endpoint, JSON.stringify(response), now.toISOString(), expiresAt.toISOString()]
    )
  } catch (error) {
    console.error('Error caching idempotent response:', error)
  }
}

export async function cleanupExpiredIdempotentRequests(): Promise<void> {
  try {
    await db.run(
      'DELETE FROM idempotent_requests WHERE expires_at < ?',
      [new Date().toISOString()]
    )
  } catch (error) {
    console.error('Error cleaning up idempotent requests:', error)
  }
}
