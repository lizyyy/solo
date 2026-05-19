import { getDb, generateId, now, generateNo } from './database';
import { Settlement, SettlementItem, SettlementStatus } from '../types';

export class SettlementModel {
  static create(data: Omit<Settlement, 'id' | 'settlementNo' | 'createdAt' | 'updatedAt'>): Settlement {
    const db = getDb();
    const id = generateId();
    const settlementNo = generateNo('S');
    const createdAt = now();
    const updatedAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO settlements (id, settlement_no, cleaner_id, cleaner_name, cleaner_phone,
        start_date, end_date, total_tasks, total_base_amount, total_rework_count,
        total_rework_deduction, total_overtime_deduction, total_complaint_deduction,
        total_photo_deduction, total_other_deduction, total_deduction, net_amount,
        status, paid_at, confirmed_at, operator_id, operator_name, remark, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, settlementNo, data.cleanerId, data.cleanerName, data.cleanerPhone,
      data.startDate, data.endDate, data.totalTasks, data.totalBaseAmount, data.totalReworkCount,
      data.totalReworkDeduction, data.totalOvertimeDeduction, data.totalComplaintDeduction,
      data.totalPhotoDeduction, data.totalOtherDeduction, data.totalDeduction, data.netAmount,
      data.status, data.paidAt, data.confirmedAt, data.operatorId, data.operatorName, data.remark,
      createdAt, updatedAt);
    
    return this.getById(id)!;
  }

  static getById(id: string): Settlement | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM settlements WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getBySettlementNo(settlementNo: string): Settlement | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM settlements WHERE settlement_no = ?').get(settlementNo) as any;
    return row ? this.mapRow(row) : null;
  }

  static list(filters: {
    cleanerId?: string;
    status?: SettlementStatus;
    startDate?: string;
    endDate?: string;
  } = {}): Settlement[] {
    const db = getDb();
    let sql = 'SELECT * FROM settlements WHERE 1=1';
    const params: any[] = [];
    
    if (filters.cleanerId) {
      sql += ' AND cleaner_id = ?';
      params.push(filters.cleanerId);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.startDate) {
      sql += ' AND end_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND start_date <= ?';
      params.push(filters.endDate);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static update(id: string, data: Partial<Settlement>): Settlement | null {
    const db = getDb();
    const updates: string[] = [];
    const params: any[] = [];
    
    const fieldMap: Record<string, string> = {
      settlementNo: 'settlement_no',
      cleanerId: 'cleaner_id',
      cleanerName: 'cleaner_name',
      cleanerPhone: 'cleaner_phone',
      startDate: 'start_date',
      endDate: 'end_date',
      totalTasks: 'total_tasks',
      totalBaseAmount: 'total_base_amount',
      totalReworkCount: 'total_rework_count',
      totalReworkDeduction: 'total_rework_deduction',
      totalOvertimeDeduction: 'total_overtime_deduction',
      totalComplaintDeduction: 'total_complaint_deduction',
      totalPhotoDeduction: 'total_photo_deduction',
      totalOtherDeduction: 'total_other_deduction',
      totalDeduction: 'total_deduction',
      netAmount: 'net_amount',
      paidAt: 'paid_at',
      confirmedAt: 'confirmed_at',
      operatorId: 'operator_id',
      operatorName: 'operator_name'
    };
    
    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key] || key;
      if (value !== undefined && dbField !== 'id') {
        updates.push(`${dbField} = ?`);
        params.push(value);
      }
    }
    
    if (updates.length === 0) return this.getById(id);
    
    updates.push('updated_at = ?');
    params.push(now());
    params.push(id);
    
    const sql = `UPDATE settlements SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    
    return this.getById(id);
  }

  static addItem(data: Omit<SettlementItem, 'id' | 'createdAt'>): SettlementItem {
    const db = getDb();
    const id = generateId();
    const createdAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO settlement_items (id, settlement_id, task_id, order_id, task_no, homestay_name,
        base_amount, rework_deduction, overtime_deduction, complaint_deduction, photo_deduction,
        other_deduction, total_deduction, net_amount, deduction_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, data.settlementId, data.taskId, data.orderId, data.taskNo, data.homestayName,
      data.baseAmount, data.reworkDeduction, data.overtimeDeduction, data.complaintDeduction,
      data.photoDeduction, data.otherDeduction, data.totalDeduction, data.netAmount,
      data.deductionIds, createdAt);
    
    return this.getItemById(id)!;
  }

  static getItemById(id: string): SettlementItem | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM settlement_items WHERE id = ?').get(id) as any;
    return row ? this.mapItemRow(row) : null;
  }

  static getItemsBySettlementId(settlementId: string): SettlementItem[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM settlement_items WHERE settlement_id = ? ORDER BY created_at').all(settlementId) as any[];
    return rows.map(row => this.mapItemRow(row));
  }

  private static mapRow(row: any): Settlement {
    return {
      id: row.id,
      settlementNo: row.settlement_no,
      cleanerId: row.cleaner_id,
      cleanerName: row.cleaner_name,
      cleanerPhone: row.cleaner_phone,
      startDate: row.start_date,
      endDate: row.end_date,
      totalTasks: row.total_tasks,
      totalBaseAmount: row.total_base_amount,
      totalReworkCount: row.total_rework_count,
      totalReworkDeduction: row.total_rework_deduction,
      totalOvertimeDeduction: row.total_overtime_deduction,
      totalComplaintDeduction: row.total_complaint_deduction,
      totalPhotoDeduction: row.total_photo_deduction,
      totalOtherDeduction: row.total_other_deduction,
      totalDeduction: row.total_deduction,
      netAmount: row.net_amount,
      status: row.status as SettlementStatus,
      paidAt: row.paid_at,
      confirmedAt: row.confirmed_at,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      remark: row.remark,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private static mapItemRow(row: any): SettlementItem {
    return {
      id: row.id,
      settlementId: row.settlement_id,
      taskId: row.task_id,
      orderId: row.order_id,
      taskNo: row.task_no,
      homestayName: row.homestay_name,
      baseAmount: row.base_amount,
      reworkDeduction: row.rework_deduction,
      overtimeDeduction: row.overtime_deduction,
      complaintDeduction: row.complaint_deduction,
      photoDeduction: row.photo_deduction,
      otherDeduction: row.other_deduction,
      totalDeduction: row.total_deduction,
      netAmount: row.net_amount,
      deductionIds: row.deduction_ids,
      createdAt: row.created_at
    };
  }
}
