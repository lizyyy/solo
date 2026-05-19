import db from '../config/database';
import { AuditLog } from '../types';

export class AuditModel {
  static log(data: Omit<AuditLog, 'id' | 'created_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO audit_log (
        operation_type, record_type, record_id, action, reason,
        passed, operator_id, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.operation_type,
      data.record_type,
      data.record_id,
      data.action,
      data.reason || null,
      data.passed ? 1 : 0,
      data.operator_id || null,
      data.details || null
    );
    return Number(result.lastInsertRowid);
  }

  static getByRecord(recordType: string, recordId: number): AuditLog[] {
    const stmt = db.prepare(`
      SELECT * FROM audit_log
      WHERE record_type = ? AND record_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(recordType, recordId) as AuditLog[];
  }

  static getAll(filters?: { operationType?: string; startDate?: string; endDate?: string }): AuditLog[] {
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params: any[] = [];

    if (filters?.operationType) {
      query += ' AND operation_type = ?';
      params.push(filters.operationType);
    }
    if (filters?.startDate) {
      query += ' AND created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      query += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    query += ' ORDER BY created_at DESC';
    const stmt = db.prepare(query);
    return stmt.all(...params) as AuditLog[];
  }
}
