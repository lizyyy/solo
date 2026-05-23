import { v4 as uuidv4 } from 'uuid';
import { getDatabase, runSync, getSync, allSync } from '../database';
import { InspectionSheet } from '../types';

export class InspectionSheetRepository {
  private get db() {
    return getDatabase();
  }

  async create(data: {
    batchId: string;
    sheetNo: string;
    inspector: string;
    inspectionDate: number;
    mileage: number;
    overallStatus: string;
    items: string;
    remarks?: string | null;
  }): Promise<InspectionSheet> {
    const now = Date.now();
    const id = uuidv4();
    await runSync(this.db, `
      INSERT INTO inspection_sheets (
        id, batch_id, sheet_no, inspector, inspection_date, mileage,
        overall_status, items, remarks, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.batchId,
      data.sheetNo,
      data.inspector,
      data.inspectionDate,
      data.mileage,
      data.overallStatus,
      data.items,
      data.remarks || null,
      'pending',
      now,
      now
    ]);
    return this.findById(id) as Promise<InspectionSheet>;
  }

  async findById(id: string): Promise<InspectionSheet | null> {
    const row = await getSync(this.db, 'SELECT * FROM inspection_sheets WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async findByBatchId(batchId: string): Promise<InspectionSheet[]> {
    const rows = await allSync(this.db, 'SELECT * FROM inspection_sheets WHERE batch_id = ? ORDER BY created_at DESC', [batchId]);
    return rows.map(row => this.mapRow(row));
  }

  async findBySheetNo(sheetNo: string): Promise<InspectionSheet | null> {
    const row = await getSync(this.db, 'SELECT * FROM inspection_sheets WHERE sheet_no = ?', [sheetNo]);
    return row ? this.mapRow(row) : null;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const now = Date.now();
    await runSync(this.db, 'UPDATE inspection_sheets SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
  }

  async deleteByBatchId(batchId: string): Promise<void> {
    await runSync(this.db, 'DELETE FROM inspection_sheets WHERE batch_id = ?', [batchId]);
  }

  private mapRow(row: any): InspectionSheet {
    return {
      id: row.id,
      batchId: row.batch_id,
      sheetNo: row.sheet_no,
      inspector: row.inspector,
      inspectionDate: row.inspection_date,
      mileage: row.mileage,
      overallStatus: row.overall_status,
      items: row.items,
      remarks: row.remarks,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
