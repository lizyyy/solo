import db from '../database';
import { v4 as uuidv4 } from 'uuid';
import type { ExportTask, ExportStatus } from '../types';

export class ExportTaskModel {
  static findAll(tenantId?: string, status?: ExportStatus): ExportTask[] {
    let query = 'SELECT * FROM export_tasks';
    const params: any[] = [];
    const conditions: string[] = [];
    if (tenantId) {
      conditions.push('tenantId = ?');
      params.push(tenantId);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY createdAt DESC';
    return db.prepare(query).all(...params) as ExportTask[];
  }

  static findById(id: string): ExportTask | null {
    return db.prepare('SELECT * FROM export_tasks WHERE id = ?').get(id) as ExportTask || null;
  }

  static findByTenantAndScope(tenantId: string, scopeId: string, statuses: ExportStatus[]): ExportTask | null {
    const placeholders = statuses.map(() => '?').join(',');
    return db.prepare(`
      SELECT * FROM export_tasks 
      WHERE tenantId = ? AND scopeId = ? AND status IN (${placeholders})
      ORDER BY createdAt DESC LIMIT 1
    `).get(tenantId, scopeId, ...statuses) as ExportTask || null;
  }

  static create(data: Omit<ExportTask, 'id' | 'progress' | 'retryCount' | 'createdAt' | 'updatedAt'>): ExportTask {
    const now = Date.now();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO export_tasks (id, tenantId, scopeId, name, status, createdBy, createdAt, updatedAt, expiredAt, maxRetries)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.tenantId,
      data.scopeId,
      data.name,
      data.status,
      data.createdBy,
      now,
      now,
      data.expiredAt,
      data.maxRetries || 3
    );
    return this.findById(id)!;
  }

  static update(id: string, data: Partial<Omit<ExportTask, 'id' | 'createdAt'>>): ExportTask | null {
    const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'createdAt');
    if (fields.length === 0) return this.findById(id);
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (data as any)[f]);
    values.push(Date.now(), id);
    db.prepare(`UPDATE export_tasks SET ${setClause}, updatedAt = ? WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static incrementRetry(id: string): number {
    const result = db.prepare(`
      UPDATE export_tasks 
      SET retryCount = retryCount + 1, updatedAt = ?
      WHERE id = ?
    `).run(Date.now(), id);
    const task = this.findById(id);
    return task?.retryCount || 0;
  }
}
