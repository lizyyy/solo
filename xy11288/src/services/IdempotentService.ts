import { db } from '../models/database';
import { v4 as uuidv4 } from 'uuid';
import { OperationType, IdempotentRequest } from '../models/types';

export class IdempotentService {
  async checkRequest(
    requestId: string,
    operationType: OperationType,
    operatorId: string
  ): Promise<{ exists: boolean; status?: string; result?: any }> {
    const request = await db.get<IdempotentRequest>(
      `SELECT * FROM idempotent_requests WHERE requestId = ?`,
      [requestId]
    );

    if (request) {
      return {
        exists: true,
        status: request.status,
        result: request.resultData ? JSON.parse(request.resultData) : null
      };
    }

    await db.run(
      `INSERT INTO idempotent_requests 
       (requestId, operationType, operatorId, status, resultData, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [requestId, operationType, operatorId, 'processing', '{}', Date.now()]
    );

    return { exists: false };
  }

  async completeRequest(
    requestId: string,
    resultData: any,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<void> {
    await db.run(
      `UPDATE idempotent_requests 
       SET status = ?, resultData = ?, completedAt = ? 
       WHERE requestId = ?`,
      [status, JSON.stringify(resultData), Date.now(), requestId]
    );
  }

  async getRequest(requestId: string): Promise<IdempotentRequest | undefined> {
    return db.get<IdempotentRequest>(
      `SELECT * FROM idempotent_requests WHERE requestId = ?`,
      [requestId]
    );
  }

  generateRequestId(): string {
    return uuidv4();
  }
}

export const idempotentService = new IdempotentService();
