import { v4 as uuidv4 } from 'uuid';
import { WorkRecord, BillingResult } from '../types';
import { DatabaseManager } from '../database/Database';

export class WorkRecordRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager?: DatabaseManager) {
    this.dbManager = dbManager || DatabaseManager.getInstance();
  }

  public findByRecordNo(recordNo: string): WorkRecord | null {
    const db = this.dbManager.getConnection();
    const row = db.prepare('SELECT * FROM work_records WHERE record_no = ?').get(recordNo);
    return row ? this.mapToWorkRecord(row) : null;
  }

  public findById(id: string): WorkRecord | null {
    const db = this.dbManager.getConnection();
    const row = db.prepare('SELECT * FROM work_records WHERE id = ?').get(id);
    return row ? this.mapToWorkRecord(row) : null;
  }

  public findAll(filters?: { status?: string; operatorName?: string; startDate?: string; endDate?: string }): WorkRecord[] {
    const db = this.dbManager.getConnection();
    let sql = 'SELECT * FROM work_records WHERE 1=1';
    const params: any[] = [];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.operatorName) {
      sql += ' AND operator_name LIKE ?';
      params.push(`%${filters.operatorName}%`);
    }
    if (filters?.startDate) {
      sql += ' AND work_date >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      sql += ' AND work_date <= ?';
      params.push(filters.endDate);
    }
    sql += ' ORDER BY work_date DESC, created_at DESC';

    const rows = db.prepare(sql).all(...params);
    return rows.map(row => this.mapToWorkRecord(row));
  }

  public insert(record: WorkRecord): WorkRecord {
    const db = this.dbManager.getConnection();
    const id = record.id || uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO work_records (
        id, record_no, tractor_no, operator_name, operator_id_card, operator_phone,
        work_date, work_type, billing_type, hours, acreage, fuel_used, fuel_price,
        hourly_rate, acreage_rate, remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      record.recordNo,
      record.tractorNo,
      record.operatorName,
      record.operatorIdCard || null,
      record.operatorPhone || null,
      record.workDate,
      record.workType,
      record.billingType,
      record.hours || null,
      record.acreage || null,
      record.fuelUsed || null,
      record.fuelPrice || null,
      record.hourlyRate || null,
      record.acreageRate || null,
      record.remarks || null,
      record.status,
      record.createdAt || now,
      record.updatedAt || now
    );

    return { ...record, id, createdAt: now, updatedAt: now };
  }

  public updateStatus(id: string, status: WorkRecord['status']): boolean {
    const db = this.dbManager.getConnection();
    const now = new Date().toISOString();
    const result = db.prepare('UPDATE work_records SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, id);
    return result.changes > 0;
  }

  public insertBillingResult(result: BillingResult): void {
    const db = this.dbManager.getConnection();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO billing_results (
        id, record_id, record_no, total_amount, hours_cost, acreage_cost, fuel_cost, billed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      result.recordId,
      result.recordNo,
      result.totalAmount,
      result.breakdown.hoursCost || null,
      result.breakdown.acreageCost || null,
      result.breakdown.fuelCost || null,
      result.billedAt
    );
  }

  public findBillingResultByRecordId(recordId: string): BillingResult | null {
    const db = this.dbManager.getConnection();
    const row = db.prepare('SELECT * FROM billing_results WHERE record_id = ?').get(recordId);
    if (!row) return null;

    return {
      recordId: row.record_id,
      recordNo: row.record_no,
      totalAmount: row.total_amount,
      billedAt: row.billed_at,
      breakdown: {
        hoursCost: row.hours_cost,
        acreageCost: row.acreage_cost,
        fuelCost: row.fuel_cost
      }
    };
  }

  public batchInsert(records: WorkRecord[]): { success: WorkRecord[]; failed: { record: WorkRecord; error: string; index: number }[] } {
    const db = this.dbManager.getConnection();
    const success: WorkRecord[] = [];
    const failed: { record: WorkRecord; error: string; index: number }[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      try {
        db.transaction(() => {
          const existing = this.findByRecordNo(record.recordNo);
          if (existing) {
            success.push(existing);
          } else {
            const inserted = this.insert(record);
            success.push(inserted);
          }
        })();
      } catch (error: any) {
        failed.push({ record, error: error.message, index: i });
      }
    }

    return { success, failed };
  }

  private mapToWorkRecord(row: any): WorkRecord {
    return {
      id: row.id,
      recordNo: row.record_no,
      tractorNo: row.tractor_no,
      operatorName: row.operator_name,
      operatorIdCard: row.operator_id_card,
      operatorPhone: row.operator_phone,
      workDate: row.work_date,
      workType: row.work_type,
      billingType: row.billing_type,
      hours: row.hours,
      acreage: row.acreage,
      fuelUsed: row.fuel_used,
      fuelPrice: row.fuel_price,
      hourlyRate: row.hourly_rate,
      acreageRate: row.acreage_rate,
      remarks: row.remarks,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
