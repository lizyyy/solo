import { BaseModel } from './BaseModel';
import { BadRecord } from '../types';

export class BadRecordModel extends BaseModel {
  protected tableName = 'bad_records';

  create(data: Omit<BadRecord, 'id' | 'resolved' | 'createdAt'>): BadRecord {
    const id = this.generateId();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO bad_records (
        id, import_id, import_type, source_file, row_number,
        column_name, original_data, failure_reason, suggested_fix,
        resolved, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.importId, data.importType, data.sourceFile,
      data.rowNumber, data.columnName || null, data.originalData,
      data.failureReason, data.suggestedFix, 0, now
    );

    return {
      ...data,
      id,
      resolved: false,
      createdAt: now,
    };
  }

  resolve(id: string, resolvedBy: string): boolean {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE bad_records SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?
    `).run(now, resolvedBy, id);
    return result.changes > 0;
  }

  findByImportId(importId: string): BadRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM bad_records WHERE import_id = ? ORDER BY row_number ASC
    `).all(importId);
    return (rows as any[]).map(this.mapRowToBadRecord);
  }

  findUnresolved(importType?: string): BadRecord[] {
    let sql = 'SELECT * FROM bad_records WHERE resolved = 0';
    const params: any[] = [];

    if (importType) {
      sql += ' AND import_type = ?';
      params.push(importType);
    }

    sql += ' ORDER BY created_at DESC';
    const rows = this.db.prepare(sql).all(...params);
    return (rows as any[]).map(this.mapRowToBadRecord);
  }

  private mapRowToBadRecord(row: any): BadRecord {
    return {
      id: row.id,
      importId: row.import_id,
      importType: row.import_type,
      sourceFile: row.source_file,
      rowNumber: row.row_number,
      columnName: row.column_name,
      originalData: row.original_data,
      failureReason: row.failure_reason,
      suggestedFix: row.suggested_fix,
      resolved: row.resolved === 1,
      resolvedAt: row.resolved_at,
      resolvedBy: row.resolved_by,
      createdAt: row.created_at,
    };
  }
}

export const badRecordModel = new BadRecordModel();