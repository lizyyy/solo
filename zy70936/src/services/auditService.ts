import { getDb } from '../database';
import { generateId } from '../utils/id';
import { AuditLog } from '../types';

export function createAuditLog(
  recordId: string,
  action: string,
  reason: string,
  operator: string,
  details: Record<string, any> = {}
): AuditLog {
  const db = getDb();
  const logId = generateId('log');
  const timestamp = Date.now();

  db.prepare(`
    INSERT INTO audit_logs (id, record_id, action, reason, operator, timestamp, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(logId, recordId, action, reason, operator, timestamp, JSON.stringify(details));

  return {
    id: logId,
    recordId,
    action,
    reason,
    operator,
    timestamp,
    details
  };
}

export function getAuditLogsForRecord(recordId: string): AuditLog[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM audit_logs WHERE record_id = ? ORDER BY timestamp DESC
  `).all(recordId) as any[];

  return rows.map(row => ({
    id: row.id,
    recordId: row.record_id,
    action: row.action,
    reason: row.reason,
    operator: row.operator,
    timestamp: row.timestamp,
    details: JSON.parse(row.details || '{}')
  }));
}

export function getAuditLogsByOperator(operator: string, limit: number = 100): AuditLog[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM audit_logs WHERE operator = ? ORDER BY timestamp DESC LIMIT ?
  `).all(operator, limit) as any[];

  return rows.map(row => ({
    id: row.id,
    recordId: row.record_id,
    action: row.action,
    reason: row.reason,
    operator: row.operator,
    timestamp: row.timestamp,
    details: JSON.parse(row.details || '{}')
  }));
}
