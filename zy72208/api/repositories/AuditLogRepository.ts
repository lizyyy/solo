import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import type { AuditLog, OperationType } from '../../shared/types.js';

export class AuditLogRepository {
  create(data: {
    detailId: string;
    batchId: string;
    operator: string;
    operationType: OperationType;
    fieldName?: string;
    oldValue?: string;
    newValue?: string;
    remark?: string;
  }): AuditLog {
    const now = new Date().toISOString();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO audit_logs (
        id, detail_id, batch_id, operator, operation_type,
        field_name, old_value, new_value, remark, operated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.detailId, data.batchId, data.operator, data.operationType,
      data.fieldName || null, data.oldValue || null, data.newValue || null,
      data.remark || null, now
    );
    return this.findById(id)!;
  }

  findById(id: string): AuditLog | null {
    const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByDetailId(detailId: string): AuditLog[] {
    const rows = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE detail_id = ? ORDER BY operated_at DESC
    `).all(detailId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByBatchId(batchId: string): AuditLog[] {
    const rows = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE batch_id = ? ORDER BY operated_at DESC
    `).all(batchId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByBatchIdAndStep(batchId: string, step: 'risk_control' | 'audit'): AuditLog[] {
    const operationTypes = step === 'risk_control' 
      ? ['TAX_RATE_UPDATE', 'CURRENCY_REVIEW']
      : ['STATUS_CHANGE', 'UPDATE'];
    
    const placeholders = operationTypes.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE batch_id = ? AND operation_type IN (${placeholders})
      ORDER BY operated_at ASC
    `).all(batchId, ...operationTypes) as any[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): AuditLog {
    return {
      id: row.id,
      detailId: row.detail_id,
      batchId: row.batch_id,
      operator: row.operator,
      operationType: row.operation_type as OperationType,
      fieldName: row.field_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      remark: row.remark,
      operatedAt: row.operated_at
    };
  }
}

export default new AuditLogRepository();
