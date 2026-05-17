import { runQuery, getOne, getAll } from '../database/connection';
import { ExceptionLog } from '../models/types';
import { v4 as uuidv4 } from 'uuid';

export class ExceptionLogDAO {
  async create(logData: Omit<ExceptionLog, 'id' | 'createdAt'>): Promise<ExceptionLog> {
    const id = uuidv4();
    const now = new Date();
    const nowStr = now.toISOString();

    await runQuery(
      `INSERT INTO exception_logs (id, request_id, endpoint, method, raw_input, error_message, error_stack, handling_basis, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, logData.requestId, logData.endpoint, logData.method, JSON.stringify(logData.rawInput), logData.errorMessage, logData.errorStack || null, logData.handlingBasis, nowStr]
    );

    return { ...logData, id, createdAt: now };
  }

  async getById(id: string): Promise<ExceptionLog | null> {
    const row = await getOne<any>('SELECT * FROM exception_logs WHERE id = ?', [id]);
    return row ? this.mapRowToLog(row) : null;
  }

  async getAll(limit: number = 100): Promise<ExceptionLog[]> {
    const rows = await getAll<any>('SELECT * FROM exception_logs ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(row => this.mapRowToLog(row));
  }

  private mapRowToLog(row: any): ExceptionLog {
    return {
      id: row.id,
      requestId: row.request_id,
      endpoint: row.endpoint,
      method: row.method,
      rawInput: row.raw_input ? JSON.parse(row.raw_input) : null,
      errorMessage: row.error_message,
      errorStack: row.error_stack,
      handlingBasis: row.handling_basis,
      createdAt: new Date(row.created_at)
    };
  }
}
