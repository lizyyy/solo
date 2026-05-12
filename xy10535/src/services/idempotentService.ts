import { store } from '../store';
import { generateId, now } from '../utils';
import type { IdempotentRequest } from '../types';

export class IdempotentService {
  recordRequest(data: {
    idempotencyKey: string;
    method: string;
    path: string;
    requestBody: any;
    responseBody: any;
    statusCode: number;
    operatorId?: string;
  }): IdempotentRequest {
    const existing = this.findByKey(data.idempotencyKey);
    if (existing) {
      return existing;
    }
    
    const record: IdempotentRequest = {
      id: generateId(),
      idempotencyKey: data.idempotencyKey,
      method: data.method,
      path: data.path,
      requestBody: JSON.stringify(data.requestBody),
      responseBody: JSON.stringify(data.responseBody),
      statusCode: data.statusCode,
      operatorId: data.operatorId || null,
      createdAt: now()
    };
    
    store.saveIdempotentRequest(record);
    return record;
  }

  findByKey(idempotencyKey: string): IdempotentRequest | null {
    return store.getIdempotentRequestByKey(idempotencyKey) || null;
  }

  hasKey(idempotencyKey: string): boolean {
    return this.findByKey(idempotencyKey) !== null;
  }

  getCachedResponse(idempotencyKey: string): { body: any; statusCode: number } | null {
    const record = this.findByKey(idempotencyKey);
    if (!record) return null;
    
    return {
      body: JSON.parse(record.responseBody),
      statusCode: record.statusCode
    };
  }

  cleanupExpired(maxAgeHours: number = 24): number {
    const cutoff = now() - maxAgeHours * 60 * 60 * 1000;
    const expired = store.getIdempotentRequests().filter(r => r.createdAt < cutoff);
    for (const r of expired) {
      store.deleteIdempotentRequest(r.idempotencyKey);
    }
    return expired.length;
  }
}

export const idempotentService = new IdempotentService();
