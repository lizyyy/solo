import { db } from '../utils/database';
import { HistoryRecord } from './types';

export class HistoryRecordDAO {
  static create(record: Omit<HistoryRecord, 'id' | 'changedAt'>): HistoryRecord {
    const id = `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const changedAt = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO history_records (id, submission_id, field_name, old_value, new_value, change_reason, source_system, changed_by, changed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      record.submissionId,
      record.fieldName,
      record.oldValue || null,
      record.newValue || null,
      record.changeReason,
      record.sourceSystem,
      record.changedBy,
      changedAt
    );

    return this.getById(id)!;
  }

  static getById(id: string): HistoryRecord | null {
    const row = db.prepare('SELECT * FROM history_records WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getBySubmissionId(submissionId: string): HistoryRecord[] {
    const rows = db.prepare('SELECT * FROM history_records WHERE submission_id = ? ORDER BY changed_at DESC').all(submissionId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static getBySourceSystem(sourceSystem: string): HistoryRecord[] {
    const rows = db.prepare('SELECT * FROM history_records WHERE source_system = ? ORDER BY changed_at DESC').all(sourceSystem) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static getAll(limit: number = 100): HistoryRecord[] {
    const rows = db.prepare('SELECT * FROM history_records ORDER BY changed_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(row => this.mapRow(row));
  }

  private static mapRow(row: any): HistoryRecord {
    return {
      id: row.id,
      submissionId: row.submission_id,
      fieldName: row.field_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      changeReason: row.change_reason,
      sourceSystem: row.source_system,
      changedBy: row.changed_by,
      changedAt: new Date(row.changed_at)
    };
  }
}
