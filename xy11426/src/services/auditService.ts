import { getDatabase } from '../db/database';
import { generateId, now } from '../utils';

export interface AuditLogOptions {
  batchId?: string;
  recordId?: string;
  operator: string;
  action: string;
  oldValue?: any;
  newValue?: any;
  ip?: string;
}

export function logAudit(options: AuditLogOptions): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO audit_logs (
      id, batch_id, record_id, operator, action, old_value, new_value, ip, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    generateId(),
    options.batchId || null,
    options.recordId || null,
    options.operator,
    options.action,
    options.oldValue !== undefined ? JSON.stringify(options.oldValue) : null,
    options.newValue !== undefined ? JSON.stringify(options.newValue) : null,
    options.ip || null,
    now()
  );
}

export function getAuditLogsByBatch(batchId: string, limit: number = 100): any[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE batch_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(batchId, limit);
}

export function getAuditLogsByRecord(recordId: string, limit: number = 100): any[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE record_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(recordId, limit);
}

export function getAuditLogsByOperator(operator: string, limit: number = 100): any[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE operator = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(operator, limit);
}

export function getAllAuditLogs(limit: number = 1000): any[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM audit_logs 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function getRecordChangeHistory(recordId: string): any[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT 
      operator,
      action,
      old_value,
      new_value,
      created_at
    FROM audit_logs 
    WHERE record_id = ? 
    ORDER BY created_at ASC
  `);
  return stmt.all(recordId);
}
