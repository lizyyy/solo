import crypto from 'crypto';
import { SeedTask } from '../models';

export class IdempotencyService {
  static generateKey(data: {
    environmentId: string;
    datasetVersionId: string;
    requestId?: string;
  }): string {
    const raw = `${data.environmentId}:${data.datasetVersionId}:${data.requestId || Date.now()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  static async checkAndLock(key: string): Promise<{ exists: boolean; task?: any }> {
    const existing = await SeedTask.findOne({ where: { idempotencyKey: key } });
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
