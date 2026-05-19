import { getDb, generateId, now, generateNo } from './database';
import { Complaint, ComplaintStatus } from '../types';

export class ComplaintModel {
  static create(data: Omit<Complaint, 'id' | 'complaintNo' | 'status' | 'deductionAmount' | 'createdAt' | 'updatedAt'>): Complaint {
    const db = getDb();
    const id = generateId();
    const complaintNo = generateNo('C');
    const status = ComplaintStatus.OPEN;
    const deductionAmount = 0;
    const createdAt = now();
    const updatedAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO complaints (id, complaint_no, order_id, task_id, reporter_id, reporter_name,
        reporter_phone, type, title, description, status, deduction_amount, filed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, complaintNo, data.orderId, data.taskId, data.reporterId, data.reporterName,
      data.reporterPhone, data.type, data.title, data.description, status, deductionAmount, data.filedAt, createdAt, updatedAt);
    
    return this.getById(id)!;
  }

  static getById(id: string): Complaint | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static list(filters: { orderId?: string; taskId?: string; status?: ComplaintStatus } = {}): Complaint[] {
    const db = getDb();
    let sql = 'SELECT * FROM complaints WHERE 1=1';
    const params: any[] = [];
    
    if (filters.orderId) {
      sql += ' AND order_id = ?';
      params.push(filters.orderId);
    }
    if (filters.taskId) {
      sql += ' AND task_id = ?';
      params.push(filters.taskId);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static update(id: string, data: Partial<Complaint>): Complaint | null {
    const db = getDb();
    const updates: string[] = [];
    const params: any[] = [];
    
    const fieldMap: Record<string, string> = {
      complaintNo: 'complaint_no',
      reporterId: 'reporter_id',
      reporterName: 'reporter_name',
      reporterPhone: 'reporter_phone',
      handlerId: 'handler_id',
      handlerName: 'handler_name',
      deductionAmount: 'deduction_amount',
      filedAt: 'filed_at',
      resolvedAt: 'resolved_at'
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
    
    const sql = `UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    
    return this.getById(id);
  }

  private static mapRow(row: any): Complaint {
    return {
      id: row.id,
      complaintNo: row.complaint_no,
      orderId: row.order_id,
      taskId: row.task_id,
      reporterId: row.reporter_id,
      reporterName: row.reporter_name,
      reporterPhone: row.reporter_phone,
      type: row.type,
      title: row.title,
      description: row.description,
      status: row.status as ComplaintStatus,
      handlerId: row.handler_id,
      handlerName: row.handler_name,
      resolution: row.resolution,
      deductionAmount: row.deduction_amount,
      filedAt: row.filed_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
