import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/client';
import { config } from '../config';
import { IdempotencyConflict } from '../utils/errors';
import { logger } from '../utils/logger';

export interface IdempotencyRecord {
  token: string;
  user_id: string;
  request_path: string;
  request_hash: string;
  response_code?: number;
  response_body?: unknown;
  created_at: Date;
  expires_at: Date;
  status: 'processing' | 'completed' | 'failed';
}

export class IdempotencyService {
  private generateRequestHash(body: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(body || {}))
      .digest('hex');
  }

  async checkAndCreate(
    token: string,
    userId: string,
    requestPath: string,
    requestBody: unknown
  ): Promise<{ isDuplicate: boolean; cachedResponse?: { code: number; body: unknown } }> {
    const requestHash = this.generateRequestHash(requestBody);
    const expiresAt = new Date(Date.now() + config.idempotency.ttlSeconds * 1000);

    try {
      const result = await db.query(
        `INSERT INTO idempotency_tokens 
         (token, user_id, request_path, request_hash, expires_at, status)
         VALUES ($1, $2, $3, $4, $5, 'processing')
         ON CONFLICT (token) DO UPDATE SET
           status = CASE 
             WHEN idempotency_tokens.status = 'processing' THEN idempotency_tokens.status
             ELSE 'completed'
           END
         RETURNING *`,
        [token, userId, requestPath, requestHash, expiresAt]
      );

      const existing = result.rows[0] as unknown as IdempotencyRecord | undefined;

      if (!existing) {
        return { isDuplicate: false };
      }

      if (existing.request_hash !== requestHash) {
        throw new IdempotencyConflict(
          'Idempotency token reused with different request payload'
        );
      }

      if (existing.status === 'completed' && existing.response_code !== undefined) {
        return {
          isDuplicate: true,
          cachedResponse: {
            code: existing.response_code,
            body: existing.response_body,
          },
        };
      }

      if (existing.status === 'processing') {
        return { isDuplicate: false };
      }

      return { isDuplicate: false };
    } catch (error) {
      if (error instanceof IdempotencyConflict) {
        throw error;
      }
      logger.error('Idempotency check error', { error: (error as Error).message });
      return { isDuplicate: false };
    }
  }

  async saveResponse(
    token: string,
    responseCode: number,
    responseBody: unknown
  ): Promise<void> {
    await db.query(
      `UPDATE idempotency_tokens
       SET status = 'completed',
           response_code = $2,
           response_body = $3,
           expires_at = CASE 
             WHEN $2 >= 200 AND $2 < 300 THEN expires_at
             ELSE CURRENT_TIMESTAMP + INTERVAL '1 hour'
           END
       WHERE token = $1`,
      [token, responseCode, JSON.stringify(responseBody)]
    );
  }

  async markFailed(token: string, error: string): Promise<void> {
    await db.query(
      `UPDATE idempotency_tokens
       SET status = 'failed',
           response_body = $2
       WHERE token = $1`,
      [token, JSON.stringify({ error })]
    );
  }

  generateToken(): string {
    return uuidv4();
  }

  async cleanupExpired(): Promise<number> {
    const result = await db.query(
      `DELETE FROM idempotency_tokens WHERE expires_at < CURRENT_TIMESTAMP`
    );
    return result.rowCount || 0;
  }
}

export const idempotencyService = new IdempotencyService();
