import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import type { SettlementDetail, DetailStatus } from '../../shared/types.js';

export class DetailRepository {
  create(data: {
    batchId: string;
    originalLineNo: number;
    originalSnapshotId: string;
    policyNo: string;
    productName: string;
    commissionAmount: number;
    currency: string;
    currencyRaw: string;
    hasMixedCurrency: boolean;
    netAmount: number;
    tierLevel: number;
    tierRate: number;
    dataFingerprint: string;
    status?: DetailStatus;
  }): SettlementDetail {
    const now = new Date().toISOString();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO settlement_details (
        id, batch_id, original_line_no, original_snapshot_id,
        policy_no, product_name, commission_amount, currency,
        currency_raw, has_mixed_currency, net_amount,
        status, tier_level, tier_rate, data_fingerprint,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.batchId, data.originalLineNo, data.originalSnapshotId,
      data.policyNo, data.productName, data.commissionAmount, data.currency,
      data.currencyRaw, data.hasMixedCurrency ? 1 : 0, data.netAmount,
      data.status || 'PENDING', data.tierLevel, data.tierRate, data.dataFingerprint,
      now, now
    );
    return this.findById(id)!;
  }

  findById(id: string): SettlementDetail | null {
    const row = db.prepare('SELECT * FROM settlement_details WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBatchId(batchId: string): SettlementDetail[] {
    const rows = db.prepare(`
      SELECT * FROM settlement_details 
      WHERE batch_id = ? ORDER BY original_line_no ASC
    `).all(batchId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByFingerprint(fingerprint: string): SettlementDetail[] {
    const rows = db.prepare(`
      SELECT * FROM settlement_details WHERE data_fingerprint = ?
    `).all(fingerprint) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByFingerprints(fingerprints: string[]): Array<{ detail: SettlementDetail; batchNo: string }> {
    const placeholders = fingerprints.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT d.*, b.batch_no
      FROM settlement_details d
      JOIN settlement_batches b ON d.batch_id = b.id
      WHERE d.data_fingerprint IN (${placeholders})
    `).all(...fingerprints) as any[];
    return rows.map(r => ({ detail: this.mapRow(r), batchNo: r.batch_no }));
  }

  updateField(id: string, fieldName: string, value: any, operator?: string): void {
    const now = new Date().toISOString();
    const columnMap: Record<string, string> = {
      taxRate: 'tax_rate',
      taxRateRemark: 'tax_rate_remark',
      status: 'status',
      currentHandler: 'current_handler',
      netAmount: 'net_amount',
      tierLevel: 'tier_level',
      tierRate: 'tier_rate'
    };
    const column = columnMap[fieldName] || fieldName;
    
    const updates = [`${column} = ?`, 'updated_at = ?'];
    const params = [value, now];
    
    if (operator) {
      updates.push('current_handler = ?');
      params.push(operator);
    }
    
    params.push(id);
    db.prepare(`UPDATE settlement_details SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  updateStatus(id: string, status: DetailStatus, operator?: string): void {
    this.updateField(id, 'status', status, operator);
  }

  recalculateNetAmount(id: string, operator?: string): number {
    const detail = this.findById(id);
    if (!detail || detail.taxRate === undefined) {
      return 0;
    }
    const netAmount = detail.commissionAmount * (1 - detail.taxRate) * detail.tierRate;
    this.updateField(id, 'netAmount', netAmount, operator);
    return netAmount;
  }

  countByBatchId(batchId: string): { total: number; exceptions: number } {
    const result = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('EXCEPTION', 'PENDING_REVIEW') THEN 1 ELSE 0 END) as exceptions
      FROM settlement_details WHERE batch_id = ?
    `).get(batchId) as { total: number; exceptions: number };
    return { total: result.total, exceptions: result.exceptions };
  }

  private mapRow(row: any): SettlementDetail {
    return {
      id: row.id,
      batchId: row.batch_id,
      originalLineNo: row.original_line_no,
      originalSnapshotId: row.original_snapshot_id,
      policyNo: row.policy_no,
      productName: row.product_name,
      commissionAmount: row.commission_amount,
      currency: row.currency,
      currencyRaw: row.currency_raw,
      hasMixedCurrency: row.has_mixed_currency === 1,
      taxRate: row.tax_rate,
      taxRateRemark: row.tax_rate_remark,
      netAmount: row.net_amount,
      status: row.status as DetailStatus,
      tierLevel: row.tier_level,
      tierRate: row.tier_rate,
      currentHandler: row.current_handler,
      dataFingerprint: row.data_fingerprint,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default new DetailRepository();
