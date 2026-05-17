import { runQuery, getOne } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

export class IdempotencyDAO {
  async checkAndSet(key: string, endpoint: string, ttlHours: number = 24): Promise<{ exists: boolean; responseData?: any }> {
    const existing = await getOne<any>(
      'SELECT response_data FROM idempotency_keys WHERE key = ? AND endpoint = ? AND expires_at > ?',
      [key, endpoint, new Date().toISOString()]
    );

    if (existing) {
      return {
        exists: true,
        responseData: existing.response_data ? JSON.parse(existing.response_data) : undefined
      };
    }

    const id = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    await runQuery(
      `INSERT INTO idempotency_keys (id, key, endpoint, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, key, endpoint, now.toISOString(), expiresAt.toISOString()]
    );

    return { exists: false };
  }

  async updateResponse(key: string, endpoint: string, responseData: any): Promise<void> {
    await runQuery(
      'UPDATE idempotency_keys SET response_data = ? WHERE key = ? AND endpoint = ?',
      [JSON.stringify(responseData), key, endpoint]
    );
  }

  async cleanupExpired(): Promise<void> {
    await runQuery('DELETE FROM idempotency_keys WHERE expires_at < ?', [new Date().toISOString()]);
  }
}
