import crypto from 'crypto';
import { db } from '../config/database';

export class IdempotencyService {
  static generateKey(data: {
    environmentId: string;
    datasetId: string;
    requestId?: string;
  }): string {
    const raw = `${data.environmentId}:${data.datasetId}:${data.requestId || Date.now()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  static async checkAndLock(key: string): Promise<{ exists: boolean; task?: any }> {
    await db.read();
    const existing = db.data.tasks.find(t => t.idempotencyKey === key);
    if (existing) {
      return { exists: true, task: existing };
    }
    return { exists: false };
  }

  static validateRequest(requestId?: string): boolean {
    if (!requestId) return true;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(requestId) || requestId.length >= 8;
  }
}
