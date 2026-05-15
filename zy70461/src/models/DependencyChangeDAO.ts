import { db } from '../utils/database';
import { DependencyChange } from './types';

export class DependencyChangeDAO {
  static create(change: Omit<DependencyChange, 'id' | 'requestedAt' | 'bothConfirmed'>): DependencyChange {
    const id = `dep-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const requestedAt = new Date().toISOString();
    
    const stmt = db.prepare(`
      INSERT INTO dependency_changes (id, dependency_name, old_version, new_version, change_reason, requester, approver, requested_at, approved_at, status, both_confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    stmt.run(
      id,
      change.dependencyName,
      change.oldVersion,
      change.newVersion,
      change.changeReason,
      change.requester,
      change.approver || null,
      requestedAt,
      change.approvedAt?.toISOString() || null,
      change.status
    );

    return this.getById(id)!;
  }

  static getById(id: string): DependencyChange | null {
    const row = db.prepare('SELECT * FROM dependency_changes WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  static getAll(status?: string): DependencyChange[] {
    let query = 'SELECT * FROM dependency_changes ORDER BY requested_at DESC';
    const params: any[] = [];
    
    if (status) {
      query = 'SELECT * FROM dependency_changes WHERE status = ? ORDER BY requested_at DESC';
      params.push(status);
    }
    
    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(row => this.mapRow(row));
  }

  static approve(id: string, approver: string): DependencyChange | null {
    const approvedAt = new Date().toISOString();
    
    db.prepare(`
      UPDATE dependency_changes 
      SET status = 'approved', approver = ?, approved_at = ?, both_confirmed = 1
      WHERE id = ?
    `).run(approver, approvedAt, id);

    return this.getById(id);
  }

  static reject(id: string, approver: string): DependencyChange | null {
    db.prepare(`
      UPDATE dependency_changes 
      SET status = 'rejected', approver = ?
      WHERE id = ?
    `).run(approver, id);

    return this.getById(id);
  }

  private static mapRow(row: any): DependencyChange {
    return {
      id: row.id,
      dependencyName: row.dependency_name,
      oldVersion: row.old_version,
      newVersion: row.new_version,
      changeReason: row.change_reason,
      requester: row.requester,
      approver: row.approver,
      requestedAt: new Date(row.requested_at),
      approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
      status: row.status as 'pending' | 'approved' | 'rejected',
      bothConfirmed: Boolean(row.both_confirmed)
    };
  }
}
