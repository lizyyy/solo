import { BaseRepository } from './base';
import { RollbackRecord, RollbackStatus } from '../../shared/types';
import { db } from '../db/init';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class RollbackRepository extends BaseRepository<RollbackRecord> {
  protected tableName = 'rollback_record';

  protected mapRow(row: Record<string, unknown>): RollbackRecord {
    return {
      id: row.id as string,
      auditId: row.audit_id as string,
      customerId: row.customer_id as string,
      productId: row.product_id as string,
      rollbackAmount: row.rollback_amount as number,
      compensationAmount: row.compensation_amount as number,
      totalAmount: row.total_amount as number,
      status: row.status as RollbackStatus,
      createdAt: row.created_at as string,
      completedAt: row.completed_at as string | null,
    };
  }

  findByAuditId(auditId: string): RollbackRecord | null {
    const row = db.prepare(`
      SELECT * FROM rollback_record WHERE audit_id = ? LIMIT 1
    `).get(auditId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByCustomerId(customerId: string): RollbackRecord[] {
    return this.findByField('customer_id', customerId);
  }

  create(data: Omit<RollbackRecord, 'id' | 'createdAt'>): RollbackRecord {
    const id = generateId('rollback');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO rollback_record (
        id, audit_id, customer_id, product_id,
        rollback_amount, compensation_amount, total_amount,
        status, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.auditId,
      data.customerId,
      data.productId,
      data.rollbackAmount,
      data.compensationAmount,
      data.totalAmount,
      data.status,
      now,
      data.completedAt
    );

    return this.findById(id)!;
  }

  updateStatus(id: string, status: RollbackStatus): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE rollback_record
      SET status = ?, completed_at = ?
      WHERE id = ?
    `).run(status, status === 'completed' ? now : null, id);
  }
}
