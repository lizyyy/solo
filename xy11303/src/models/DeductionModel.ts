import { getDb, generateId, now, generateNo } from './database';
import { Deduction, DeductionType } from '../types';

export class DeductionModel {
  static create(data: Omit<Deduction, 'id' | 'deductionNo' | 'isAppealed' | 'isConfirmed' | 'createdAt' | 'updatedAt'>): Deduction {
    const db = getDb();
    const id = generateId();
    const deductionNo = generateNo('D');
    const isAppealed = false;
    const isConfirmed = false;
    const createdAt = now();
    const updatedAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO deductions (id, deduction_no, settlement_id, task_id, order_id, type, amount,
        reason, related_id, related_type, operator_id, operator_name, is_appealed, is_confirmed,
        created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, deductionNo, data.settlementId, data.taskId, data.orderId, data.type, data.amount,
      data.reason, data.relatedId, data.relatedType, data.operatorId, data.operatorName,
      isAppealed ? 1 : 0, isConfirmed ? 1 : 0, createdAt, updatedAt);
    
    return this.getById(id)!;
  }

  static getById(id: string): Deduction | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM deductions WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getByDeductionNo(deductionNo: string): Deduction | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM deductions WHERE deduction_no = ?').get(deductionNo) as any;
    return row ? this.mapRow(row) : null;
  }

  static getByTaskId(taskId: string): Deduction[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM deductions WHERE task_id = ? ORDER BY created_at').all(taskId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static getBySettlementId(settlementId: string): Deduction[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM deductions WHERE settlement_id = ? ORDER BY created_at').all(settlementId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static list(filters: {
    taskId?: string;
    settlementId?: string;
    type?: DeductionType;
    isConfirmed?: boolean;
    startDate?: string;
    endDate?: string;
  } = {}): Deduction[] {
    const db = getDb();
    let sql = 'SELECT * FROM deductions WHERE 1=1';
    const params: any[] = [];
    
    if (filters.taskId) {
      sql += ' AND task_id = ?';
      params.push(filters.taskId);
    }
    if (filters.settlementId) {
      sql += ' AND settlement_id = ?';
      params.push(filters.settlementId);
    }
    if (filters.type) {
      sql += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters.isConfirmed !== undefined) {
      sql += ' AND is_confirmed = ?';
      params.push(filters.isConfirmed ? 1 : 0);
    }
    if (filters.startDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.endDate);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static update(id: string, data: Partial<Deduction>): Deduction | null {
    const db = getDb();
    const updates: string[] = [];
    const params: any[] = [];
    
    const fieldMap: Record<string, string> = {
      deductionNo: 'deduction_no',
      settlementId: 'settlement_id',
      operatorId: 'operator_id',
      operatorName: 'operator_name',
      isAppealed: 'is_appealed',
      appealReason: 'appeal_reason',
      isConfirmed: 'is_confirmed',
      confirmedAt: 'confirmed_at',
      relatedId: 'related_id',
      relatedType: 'related_type'
    };
    
    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key] || key;
      if (value !== undefined && dbField !== 'id') {
        updates.push(`${dbField} = ?`);
        params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    }
    
    if (updates.length === 0) return this.getById(id);
    
    updates.push('updated_at = ?');
    params.push(now());
    params.push(id);
    
    const sql = `UPDATE deductions SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    
    return this.getById(id);
  }

  static confirm(id: string): Deduction | null {
    return this.update(id, { isConfirmed: true, confirmedAt: now() });
  }

  private static mapRow(row: any): Deduction {
    return {
      id: row.id,
      deductionNo: row.deduction_no,
      settlementId: row.settlement_id,
      taskId: row.task_id,
      orderId: row.order_id,
      type: row.type as DeductionType,
      amount: row.amount,
      reason: row.reason,
      relatedId: row.related_id,
      relatedType: row.related_type,
      operatorId: row.operator_id,
      operatorName: row.operator_name,
      isAppealed: row.is_appealed === 1,
      appealReason: row.appeal_reason,
      isConfirmed: row.is_confirmed === 1,
      confirmedAt: row.confirmed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
