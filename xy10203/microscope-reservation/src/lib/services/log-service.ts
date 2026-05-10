import db from '../db';
import { generateId, nowISO } from '../utils';

export interface LogAction {
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId?: string;
  note?: string;
}

export function logAction(log: LogAction): void {
  const stmt = db.prepare(`
    INSERT INTO operation_logs (
      id, entity_type, entity_id, action, old_values, new_values, user_id, timestamp, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    generateId(),
    log.entityType,
    log.entityId,
    log.action,
    log.oldValues ? JSON.stringify(log.oldValues) : null,
    log.newValues ? JSON.stringify(log.newValues) : null,
    log.userId || null,
    nowISO(),
    log.note || null
  );
}

export function getEntityLogs(entityType: string, entityId: string): any[] {
  return db.prepare(`
    SELECT * FROM operation_logs
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY timestamp DESC
  `).all(entityType, entityId) as any[];
}

export function getAllLogs(limit: number = 100): any[] {
  return db.prepare(`
    SELECT * FROM operation_logs
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as any[];
}
