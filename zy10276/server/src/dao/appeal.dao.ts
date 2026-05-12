import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface AppealMaterial {
  id: string;
  name: string;
  type: string;
  uploadTime: string;
}

export interface Appeal {
  id: string;
  violationId: string;
  driverId: string;
  reason: string;
  materials?: AppealMaterial[];
  status: 'pending' | 'approved' | 'rejected';
  reviewer?: string;
  reviewNotes?: string;
  reviewedAt?: string;
  createdAt: string;
}

export class AppealDAO {
  static getByViolationId(violationId: string): Appeal | undefined {
    const stmt = db.prepare(`
      SELECT 
        id, violation_id as violationId, driver_id as driverId, reason,
        materials_json as materialsJson, status, reviewer, review_notes as reviewNotes,
        reviewed_at as reviewedAt, created_at as createdAt
      FROM appeals WHERE violation_id = ?
    `);
    const row = stmt.get(violationId) as any;
    if (!row) return undefined;

    return {
      ...row,
      materials: row.materialsJson ? JSON.parse(row.materialsJson) : undefined,
    };
  }

  static create(data: Omit<Appeal, 'id' | 'createdAt'>): Appeal {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO appeals (
        id, violation_id, driver_id, reason, materials_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.violationId, data.driverId, data.reason,
      data.materials ? JSON.stringify(data.materials) : null,
      data.status || 'pending', now
    );
    return this.getByViolationId(data.violationId)!;
  }

  static review(violationId: string, status: 'approved' | 'rejected', reviewNotes: string, reviewer: string): Appeal | null {
    const appeal = this.getByViolationId(violationId);
    if (!appeal) return null;

    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE appeals 
      SET status = ?, review_notes = ?, reviewer = ?, reviewed_at = ?
      WHERE violation_id = ?
    `);
    stmt.run(status, reviewNotes, reviewer, now, violationId);

    return this.getByViolationId(violationId) || null;
  }
}

export default AppealDAO;
