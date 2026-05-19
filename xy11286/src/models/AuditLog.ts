import { BaseModel } from './BaseModel';
import { AuditLog, AuditAction } from '../types';

export class AuditLogModel extends BaseModel {
  protected tableName = 'audit_logs';

  create(data: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
    const id = this.generateId();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO audit_logs (
        id, entity_type, entity_id, action, operator_id,
        operator_name, old_value, new_value, notes, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.entityType, data.entityId, data.action,
      data.operatorId, data.operatorName,
      data.oldValue || null, data.newValue || null,
      data.notes || null, now
    );

    return { ...data, id, timestamp: now };
  }

  findByEntity(entityType: string, entityId: string): AuditLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_logs 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY timestamp DESC
    `).all(entityType, entityId);
    return (rows as any[]).map(this.mapRowToAuditLog);
  }

  findByAction(action: AuditAction): AuditLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_logs WHERE action = ? ORDER BY timestamp DESC
    `).all(action);
    return (rows as any[]).map(this.mapRowToAuditLog);
  }

  findByOperator(operatorId: string): AuditLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_logs WHERE operator_id = ? ORDER BY timestamp DESC
    `).all(operatorId);
    return (rows as any[]).map(this.mapRowToAuditLog);
  }

  findRecent(limit: number = 100): AuditLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?
    `).all(limit);
    return (rows as any[]).map(this.mapRowToAuditLog);
  }

  private mapRowToAuditLog(row: any): AuditLog {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action as AuditAction,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      notes: row.notes,
      timestamp: row.timestamp,
    };
  }
}

export const auditLogModel = new AuditLogModel();