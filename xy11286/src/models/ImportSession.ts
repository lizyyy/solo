import { BaseModel } from './BaseModel';
import { ImportSession } from '../types';
import { createHash } from 'crypto';

export class ImportSessionModel extends BaseModel {
  protected tableName = 'import_sessions';

  create(data: Omit<ImportSession, 'id' | 'startedAt' | 'completedAt'>): ImportSession {
    const id = this.generateId();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO import_sessions (
        id, import_type, source_file, file_hash,
        total_records, success_count, failure_count,
        status, started_at, operator_id, operator_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.importType, data.sourceFile, data.fileHash,
      data.totalRecords, data.successCount, data.failureCount,
      data.status, now, data.operatorId, data.operatorName
    );

    return {
      ...data,
      id,
      startedAt: now,
      completedAt: undefined,
    };
  }

  complete(id: string, successCount: number, failureCount: number): boolean {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE import_sessions 
      SET status = 'completed', success_count = ?, failure_count = ?, completed_at = ?
      WHERE id = ?
    `).run(successCount, failureCount, now, id);
    return result.changes > 0;
  }

  fail(id: string): boolean {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE import_sessions SET status = 'failed', completed_at = ? WHERE id = ?
    `).run(now, id);
    return result.changes > 0;
  }

  findByFileHash(importType: string, fileHash: string): ImportSession | undefined {
    const row = this.db.prepare(`
      SELECT * FROM import_sessions WHERE import_type = ? AND file_hash = ?
    `).get(importType, fileHash);
    return row ? this.mapRowToSession(row as any) : undefined;
  }

  findRecent(limit: number = 10): ImportSession[] {
    const rows = this.db.prepare(`
      SELECT * FROM import_sessions ORDER BY started_at DESC LIMIT ?
    `).all(limit);
    return (rows as any[]).map(this.mapRowToSession);
  }

  private mapRowToSession(row: any): ImportSession {
    return {
      id: row.id,
      importType: row.import_type,
      sourceFile: row.source_file,
      fileHash: row.file_hash,
      totalRecords: row.total_records,
      successCount: row.success_count,
      failureCount: row.failure_count,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
    };
  }

  static calculateFileHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }
}

export const importSessionModel = new ImportSessionModel();