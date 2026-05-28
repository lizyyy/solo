import { BaseRepository } from './base';
import { AuditRecord, AuditStatus } from '../../shared/types';
import { db } from '../db/init';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export class AuditRepository extends BaseRepository<AuditRecord> {
  protected tableName = 'audit_record';

  protected mapRow(row: Record<string, unknown>): AuditRecord {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      customerName: row.customer_name as string,
      productId: row.product_id as string,
      productName: row.product_name as string,
      shareId: row.share_id as string,
      contractId: row.contract_id as string,
      rateVersionId: row.rate_version_id as string,
      promotionId: row.promotion_id as string | null,
      chargeId: row.charge_id as string,
      status: row.status as AuditStatus,
      expectedAmount: row.expected_amount as number,
      actualAmount: row.actual_amount as number,
      diffAmount: row.diff_amount as number,
      reasons: JSON.parse(row.reasons as string) as string[],
      auditTime: row.audit_time as string,
      resolvedTime: row.resolved_time as string | null,
      rollbackId: row.rollback_id as string | null,
    };
  }

  findByCustomerId(customerId: string): AuditRecord[] {
    return this.findByField('customer_id', customerId);
  }

  findByProductId(productId: string): AuditRecord[] {
    return this.findByField('product_id', productId);
  }

  findByStatus(status: AuditStatus): AuditRecord[] {
    return this.findByField('status', status);
  }

  findWithFilters(filters: {
    status?: AuditStatus;
    customerId?: string;
    productId?: string;
    startDate?: string;
    endDate?: string;
  }): AuditRecord[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.customerId) {
      conditions.push('customer_id = ?');
      params.push(filters.customerId);
    }
    if (filters.productId) {
      conditions.push('product_id = ?');
      params.push(filters.productId);
    }
    if (filters.startDate) {
      conditions.push('audit_time >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('audit_time <= ?');
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM audit_record ${whereClause} ORDER BY audit_time DESC`;

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(row => this.mapRow(row));
  }

  create(data: Omit<AuditRecord, 'id' | 'auditTime'>): AuditRecord {
    const id = generateId('audit');
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO audit_record (
        id, customer_id, customer_name, product_id, product_name,
        share_id, contract_id, rate_version_id, promotion_id, charge_id,
        status, expected_amount, actual_amount, diff_amount, reasons,
        audit_time, resolved_time, rollback_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.customerId,
      data.customerName,
      data.productId,
      data.productName,
      data.shareId,
      data.contractId,
      data.rateVersionId,
      data.promotionId,
      data.chargeId,
      data.status,
      data.expectedAmount,
      data.actualAmount,
      data.diffAmount,
      JSON.stringify(data.reasons),
      now,
      data.resolvedTime,
      data.rollbackId
    );

    return this.findById(id)!;
  }

  updateStatus(id: string, status: AuditStatus): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE audit_record
      SET status = ?, resolved_time = ?
      WHERE id = ?
    `).run(status, status === 'resolved' ? now : null, id);
  }

  updateRollbackId(id: string, rollbackId: string): void {
    db.prepare(`
      UPDATE audit_record
      SET rollback_id = ?
      WHERE id = ?
    `).run(rollbackId, id);
  }

  getStats(): { total: number; pending: number; normal: number; abnormal: number; resolved: number; totalDiffAmount: number } {
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'normal' THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN status = 'abnormal' THEN 1 ELSE 0 END) as abnormal,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'abnormal' THEN diff_amount ELSE 0 END) as totalDiffAmount
      FROM audit_record
    `).get() as Record<string, unknown>;

    return {
      total: row.total as number,
      pending: row.pending as number,
      normal: row.normal as number,
      abnormal: row.abnormal as number,
      resolved: row.resolved as number,
      totalDiffAmount: row.totalDiffAmount as number,
    };
  }
}
