import { getDb, generateId, now, generateNo } from './database';
import { CleaningTask, TaskStatus } from '../types';

export class CleaningTaskModel {
  static create(data: Omit<CleaningTask, 'id' | 'taskNo' | 'status' | 'submittedPhotos' | 'createdAt' | 'updatedAt'>): CleaningTask {
    const db = getDb();
    const id = generateId();
    const taskNo = generateNo('T');
    const status = TaskStatus.PENDING;
    const submittedPhotos = 0;
    const createdAt = now();
    const updatedAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO cleaning_tasks (id, task_no, order_id, homestay_id, homestay_name, cleaner_id,
        cleaner_name, cleaner_phone, scheduled_date, deadline, status, required_photos,
        submitted_photos, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, taskNo, data.orderId, data.homestayId, data.homestayName, data.cleanerId,
      data.cleanerName, data.cleanerPhone, data.scheduledDate, data.deadline, status, data.requiredPhotos,
      submittedPhotos, createdAt, updatedAt);
    
    return this.getById(id)!;
  }

  static getById(id: string): CleaningTask | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM cleaning_tasks WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getByTaskNo(taskNo: string): CleaningTask | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM cleaning_tasks WHERE task_no = ?').get(taskNo) as any;
    return row ? this.mapRow(row) : null;
  }

  static list(filters: {
    cleanerId?: string;
    homestayId?: string;
    status?: TaskStatus;
    startDate?: string;
    endDate?: string;
  } = {}): CleaningTask[] {
    const db = getDb();
    let sql = 'SELECT * FROM cleaning_tasks WHERE 1=1';
    const params: any[] = [];
    
    if (filters.cleanerId) {
      sql += ' AND cleaner_id = ?';
      params.push(filters.cleanerId);
    }
    if (filters.homestayId) {
      sql += ' AND homestay_id = ?';
      params.push(filters.homestayId);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.startDate) {
      sql += ' AND scheduled_date >= ?';
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ' AND scheduled_date <= ?';
      params.push(filters.endDate);
    }
    
    sql += ' ORDER BY scheduled_date DESC, created_at DESC';
    
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static update(id: string, data: Partial<CleaningTask>): CleaningTask | null {
    const db = getDb();
    const updates: string[] = [];
    const params: any[] = [];
    
    const fieldMap: Record<string, string> = {
      cleanerId: 'cleaner_id',
      cleanerName: 'cleaner_name',
      cleanerPhone: 'cleaner_phone',
      scheduledDate: 'scheduled_date',
      requiredPhotos: 'required_photos',
      submittedPhotos: 'submitted_photos',
      startedAt: 'started_at',
      submittedAt: 'submitted_at',
      approvedAt: 'approved_at',
      completedAt: 'completed_at',
      assignedAt: 'assigned_at'
    };
    
    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key] || key;
      if (value !== undefined && dbField !== 'id' && dbField !== 'task_no') {
        updates.push(`${dbField} = ?`);
        params.push(value);
      }
    }
    
    if (updates.length === 0) return this.getById(id);
    
    updates.push('updated_at = ?');
    params.push(now());
    params.push(id);
    
    const sql = `UPDATE cleaning_tasks SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    
    return this.getById(id);
  }

  static getTasksForSettlement(cleanerId: string, startDate: string, endDate: string): CleaningTask[] {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM cleaning_tasks 
      WHERE cleaner_id = ? 
        AND status = ?
        AND scheduled_date >= ? 
        AND scheduled_date <= ?
      ORDER BY scheduled_date
    `).all(cleanerId, TaskStatus.COMPLETED, startDate, endDate) as any[];
    
    return rows.map(row => this.mapRow(row));
  }

  private static mapRow(row: any): CleaningTask {
    return {
      id: row.id,
      taskNo: row.task_no,
      orderId: row.order_id,
      homestayId: row.homestay_id,
      homestayName: row.homestay_name,
      cleanerId: row.cleaner_id,
      cleanerName: row.cleaner_name,
      cleanerPhone: row.cleaner_phone,
      scheduledDate: row.scheduled_date,
      deadline: row.deadline,
      status: row.status as TaskStatus,
      requiredPhotos: row.required_photos,
      submittedPhotos: row.submitted_photos,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      approvedAt: row.approved_at,
      completedAt: row.completed_at,
      assignedAt: row.assigned_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
