import { v4 as uuidv4 } from 'uuid';
import { getDatabase, runSync, getSync, allSync } from '../database';
import { AuditLog, AuditAction } from '../types';

export class AuditLogRepository {
  private get db() {
    return getDatabase();
  }

  async create(data: {
    batchId?: string | null;
    itemType?: string | null;
    itemId?: string | null;
    action: AuditAction;
    oldValue?: string | null;
    newValue?: string | null;
    operator: string;
    operatorRole: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    remark?: string | null;
  }): Promise<AuditLog> {
    const now = Date.now();
    const id = uuidv4();
    await runSync(this.db, `
      INSERT INTO audit_logs (
        id, batch_id, item_type, item_id, action, old_value, new_value,
        operator, operator_role, ip_address, user_agent, remark, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.batchId || null,
      data.itemType || null,
      data.itemId || null,
      data.action,
      data.oldValue || null,
      data.newValue || null,
      data.operator,
      data.operatorRole,
      data.ipAddress || null,
      data.userAgent || null,
      data.remark || null,
      now
    ]);
    return this.findById(id) as Promise<AuditLog>;
  }

  async findById(id: string): Promise<AuditLog | null> {
    const row = await getSync(this.db, 'SELECT * FROM audit_logs WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async findByBatchId(batchId: string): Promise<AuditLog[]> {
    const rows = await allSync(this.db, 'SELECT * FROM audit_logs WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
    return rows.map(row => this.mapRow(row));
  }

  async findByAction(action: AuditAction): Promise<AuditLog[]> {
    const rows = await allSync(this.db, 'SELECT * FROM audit_logs WHERE action = ? ORDER BY created_at DESC', [action]);
    return rows.map(row => this.mapRow(row));
  }

  async findByOperator(operator: string): Promise<AuditLog[]> {
    const rows = await allSync(this.db, 'SELECT * FROM audit_logs WHERE operator = ? ORDER BY created_at DESC', [operator]);
    return rows.map(row => this.mapRow(row));
  }

  async findAll(limit: number = 100): Promise<AuditLog[]> {
    const rows = await allSync(this.db, 'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(row => this.mapRow(row));
  }

  private mapRow(row: any): AuditLog {
    return {
      id: row.id,
      batchId: row.batch_id,
      itemType: row.item_type,
      itemId: row.item_id,
      action: row.action as AuditAction,
      oldValue: row.old_value,
      newValue: row.new_value,
      operator: row.operator,
      operatorRole: row.operator_role,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      remark: row.remark,
      createdAt: row.created_at
    };
  }
}
