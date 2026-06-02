import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import type { SettlementBatch, BatchStatus } from '../../shared/types.js';

export class BatchRepository {
  create(data: {
    batchNo: string;
    importDate: string;
    importOperator: string;
    totalRecords: number;
    exceptionRecords: number;
  }): SettlementBatch {
    const now = new Date().toISOString();
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO settlement_batches (
        id, batch_no, status, import_date, import_operator,
        total_records, exception_records, created_at, updated_at
      ) VALUES (?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.batchNo, data.importDate, data.importOperator,
      data.totalRecords, data.exceptionRecords, now, now
    );
    return this.findById(id)!;
  }

  findById(id: string): SettlementBatch | null {
    const row = db.prepare('SELECT * FROM settlement_batches WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBatchNo(batchNo: string): SettlementBatch | null {
    const row = db.prepare('SELECT * FROM settlement_batches WHERE batch_no = ?').get(batchNo) as any;
    return row ? this.mapRow(row) : null;
  }

  findAll(status?: BatchStatus, page: number = 1, pageSize: number = 20): { items: SettlementBatch[]; total: number } {
    let whereClause = '';
    const params: any[] = [];
    if (status) {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }
    const total = db.prepare(`SELECT COUNT(*) as count FROM settlement_batches ${whereClause}`).get(...params) as { count: number };
    const rows = db.prepare(`
      SELECT * FROM settlement_batches ${whereClause}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(...params, pageSize, (page - 1) * pageSize) as any[];
    return {
      items: rows.map(r => this.mapRow(r)),
      total: total.count
    };
  }

  updateStatus(id: string, status: BatchStatus, operator?: string): void {
    const now = new Date().toISOString();
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const params: any[] = [status, now];
    
    if (status === 'RISK_REVIEWED' && operator) {
      updates.push('risk_operator = ?');
      params.push(operator);
    }
    if (status === 'AUDITED' && operator) {
      updates.push('audit_operator = ?');
      params.push(operator);
    }
    
    params.push(id);
    db.prepare(`UPDATE settlement_batches SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  updateCounts(id: string, totalRecords: number, exceptionRecords: number): void {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE settlement_batches 
      SET total_records = ?, exception_records = ?, updated_at = ?
      WHERE id = ?
    `).run(totalRecords, exceptionRecords, now, id);
  }

  delete(id: string): void {
    db.prepare('DELETE FROM settlement_batches WHERE id = ?').run(id);
  }

  private mapRow(row: any): SettlementBatch {
    return {
      id: row.id,
      batchNo: row.batch_no,
      status: row.status as BatchStatus,
      sourceFile: row.source_file || '除权日截图.xlsx',
      sourceType: row.source_type || 'SCREENSHOT',
      totalCount: row.total_records || 0,
      totalCommissionAmount: row.total_commission_amount || 0,
      totalTaxAmount: row.total_tax_amount || 0,
      totalNetAmount: row.total_net_amount || 0,
      warningCount: row.warning_count || 0,
      hasMixedCurrency: row.has_mixed_currency || 0,
      importedBy: row.imported_by || row.import_operator,
      importedAt: row.imported_at || row.import_date,
      riskReviewedBy: row.risk_reviewed_by || row.risk_operator,
      riskReviewedAt: row.risk_reviewed_at,
      auditedBy: row.audited_by || row.audit_operator,
      auditedAt: row.audited_at,
      importDate: row.import_date,
      importOperator: row.import_operator,
      riskOperator: row.risk_operator,
      auditOperator: row.audit_operator,
      totalRecords: row.total_records,
      exceptionRecords: row.exception_records,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default new BatchRepository();
