import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getOne, getAll } from '../utils/db-helpers';
import { FailedOperation } from '../types';

interface FailedOperationRow {
  id: string;
  operation_type: string;
  payload: string;
  error_message: string;
  retry_count: number;
  next_retry_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const failedOperationService = {
  async createOperation(
    operationType: string,
    payload: string,
    errorMessage: string
  ): Promise<FailedOperation> {
    const id = uuidv4();
    const now = dayjs().toISOString();
    const nextRetryAt = dayjs().add(5, 'minute').toISOString();

    await runQuery(
      `INSERT INTO failed_operations (
        id, operation_type, payload, error_message, 
        retry_count, next_retry_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, operationType, payload, errorMessage, 0, nextRetryAt, 'PENDING', now, now]
    );

    return this.getOperationById(id);
  },

  async getOperationById(id: string): Promise<FailedOperation> {
    const row = await getOne<FailedOperationRow>(
      'SELECT * FROM failed_operations WHERE id = ?',
      [id]
    );

    if (!row) {
      throw new Error(`失败操作不存在: ${id}`);
    }

    return this.rowToOperation(row);
  },

  async getPendingOperations(): Promise<FailedOperation[]> {
    const now = dayjs().toISOString();
    const rows = await getAll<FailedOperationRow>(
      `SELECT * FROM failed_operations 
       WHERE status = 'PENDING' AND next_retry_at <= ?
       ORDER BY next_retry_at ASC`,
      [now]
    );

    return rows.map(this.rowToOperation);
  },

  async getAllOperations(limit: number = 100): Promise<FailedOperation[]> {
    const rows = await getAll<FailedOperationRow>(
      `SELECT * FROM failed_operations 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );

    return rows.map(this.rowToOperation);
  },

  async updateStatus(
    id: string,
    status: 'PENDING' | 'SUCCESS' | 'FAILED',
    errorMessage?: string
  ): Promise<FailedOperation> {
    const operation = await this.getOperationById(id);
    const now = dayjs().toISOString();
    const nextRetryAt = status === 'FAILED' 
      ? dayjs().add(Math.min(30 * Math.pow(2, operation.retryCount), 1440), 'minute').toISOString()
      : null;

    await runQuery(
      `UPDATE failed_operations 
       SET status = ?, 
           error_message = ?, 
           retry_count = ?, 
           next_retry_at = ?, 
           updated_at = ?
       WHERE id = ?`,
      [
        status,
        errorMessage || null,
        operation.retryCount + 1,
        nextRetryAt,
        now,
        id
      ]
    );

    return this.getOperationById(id);
  },

  async markSuccess(id: string): Promise<FailedOperation> {
    return this.updateStatus(id, 'SUCCESS');
  },

  async markFailed(id: string, errorMessage: string): Promise<FailedOperation> {
    return this.updateStatus(id, 'FAILED', errorMessage);
  },

  rowToOperation(row: FailedOperationRow): FailedOperation {
    return {
      id: row.id,
      operationType: row.operation_type,
      payload: row.payload,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      nextRetryAt: row.next_retry_at,
      status: row.status as 'PENDING' | 'FAILED' | 'SUCCESS',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};