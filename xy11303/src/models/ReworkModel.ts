import { getDb, generateId, now, generateNo } from './database';
import { Rework, TaskStatus } from '../types';

export class ReworkModel {
  static create(data: Omit<Rework, 'id' | 'reworkNo' | 'status' | 'photosSubmitted' | 'createdAt' | 'updatedAt'>): Rework {
    const db = getDb();
    const id = generateId();
    const reworkNo = generateNo('R');
    const status = TaskStatus.ASSIGNED;
    const photosSubmitted = 0;
    const createdAt = now();
    const updatedAt = now();
    
    const stmt = db.prepare(`
      INSERT INTO reworks (id, rework_no, task_id, order_id, reason, requester_id, requester_name,
        cleaner_id, cleaner_name, deadline, status, photos_required, photos_submitted, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, reworkNo, data.taskId, data.orderId, data.reason, data.requesterId, data.requesterName,
      data.cleanerId, data.cleanerName, data.deadline, status, data.photosRequired, photosSubmitted, createdAt, updatedAt);
    
    return this.getById(id)!;
  }

  static getById(id: string): Rework | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM reworks WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getByTaskId(taskId: string): Rework[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM reworks WHERE task_id = ? ORDER BY created_at DESC').all(taskId) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static list(filters: { cleanerId?: string; status?: TaskStatus; startDate?: string; endDate?: string } = {}): Rework[] {
    const db = getDb();
    let sql = 'SELECT * FROM reworks WHERE 1=1';
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

  static update(id: string, data: Partial<Rework>): Rework | null {
    const db = getDb();
    const updates: string[] = [];
    const params: any[] = [];
    
    const fieldMap: Record<string, string> = {
      requesterId: 'requester_id',
      requesterName: 'requester_name',
      cleanerId: 'cleaner_id',
      cleanerName: 'cleaner_name',
      photosRequired: 'photos_required',
      photosSubmitted: 'photos_submitted',
      startedAt: 'started_at',
      submittedAt: 'submitted_at',
      approvedAt: 'approved_at',
      completedAt: 'completed_at'
    };
    
    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key] || key;
      if (value !== undefined && dbField !== 'id' && dbField !== 'rework_no') {
        updates.push(`${dbField} = ?`);
        params.push(value);
      }
    }
    
    if (updates.length === 0) return this.getById(id);
    
    updates.push('updated_at = ?');
    params.push(now());
    params.push(id);
    
    const sql = `UPDATE reworks SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...params);
    
    return this.getById(id);
  }

  private static mapRow(row: any): Rework {
    return {
      id: row.id,
      reworkNo: row.rework_no,
      taskId: row.task_id,
      orderId: row.order_id,
      reason: row.reason,
      requesterId: row.requester_id,
      requesterName: row.requester_name,
      cleanerId: row.cleaner_id,
      cleanerName: row.cleaner_name,
      deadline: row.deadline,
      status: row.status as TaskStatus,
      photosRequired: row.photos_required,
      photosSubmitted: row.photos_submitted,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
      approvedAt: row.approved_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
