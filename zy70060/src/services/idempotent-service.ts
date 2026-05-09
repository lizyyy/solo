import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getOne, beginTransaction, commitTransaction, rollbackTransaction } from '../utils/db-helpers';
import { IdempotentStatus, IdempotentRecord } from '../types';

interface IdempotentRecordRow {
  id: string;
  idempotent_key: string;
  status: string;
  response: string;
  created_at: string;
  updated_at: string;
}

export const idempotentService = {
  async createRecord(idempotentKey: string): Promise<IdempotentRecord> {
    const id = uuidv4();
    const now = dayjs().toISOString();

    await runQuery(
      `INSERT INTO idempotent_records (
        id, idempotent_key, status, response, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, idempotentKey, 'PROCESSING', null, now, now]
    );

    return {
      id,
      idempotentKey,
      status: 'PROCESSING',
      response: '',
      createdAt: now,
      updatedAt: now
    };
  },

  async getRecord(idempotentKey: string): Promise<IdempotentRecord | undefined> {
    const row = await getOne<IdempotentRecordRow>(
      'SELECT * FROM idempotent_records WHERE idempotent_key = ?',
      [idempotentKey]
    );

    return row ? this.rowToRecord(row) : undefined;
  },

  async updateSuccess(idempotentKey: string, response: string): Promise<void> {
    const now = dayjs().toISOString();

    await runQuery(
      `UPDATE idempotent_records 
       SET status = ?, response = ?, updated_at = ?
       WHERE idempotent_key = ?`,
      ['SUCCESS', response, now, idempotentKey]
    );
  },

  async updateFailed(idempotentKey: string, response: string): Promise<void> {
    const now = dayjs().toISOString();

    await runQuery(
      `UPDATE idempotent_records 
       SET status = ?, response = ?, updated_at = ?
       WHERE idempotent_key = ?`,
      ['FAILED', response, now, idempotentKey]
    );
  },

  async withIdempotent<T>(
    idempotentKey: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; isNew: boolean }> {
    const existingRecord = await this.getRecord(idempotentKey);

    if (existingRecord) {
      if (existingRecord.status === 'SUCCESS') {
        return {
          result: JSON.parse(existingRecord.response),
          isNew: false
        };
      }
      if (existingRecord.status === 'PROCESSING') {
        throw new Error('请求正在处理中，请稍后重试');
      }
      if (existingRecord.status === 'FAILED') {
        throw new Error(existingRecord.response || '请求已失败，请检查错误信息');
      }
    }

    await this.createRecord(idempotentKey);

    try {
      const result = await operation();
      await this.updateSuccess(idempotentKey, JSON.stringify(result));
      return { result, isNew: true };
    } catch (error: any) {
      await this.updateFailed(idempotentKey, error.message);
      throw error;
    }
  },

  rowToRecord(row: IdempotentRecordRow): IdempotentRecord {
    return {
      id: row.id,
      idempotentKey: row.idempotent_key,
      status: row.status as IdempotentStatus,
      response: row.response || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
};