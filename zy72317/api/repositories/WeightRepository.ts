import db from '../db';
import type { ScoreWeight } from '../../shared/types';

export class WeightRepository {
  findAll(): ScoreWeight[] {
    const stmt = db.prepare('SELECT * FROM score_weight ORDER BY id ASC');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapToModel(row));
  }

  findById(id: string): ScoreWeight | null {
    const stmt = db.prepare('SELECT * FROM score_weight WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapToModel(row) : null;
  }

  updateWeight(id: string, weight: number): ScoreWeight | null {
    const stmt = db.prepare(`
      UPDATE score_weight 
      SET weight = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(weight, id);
    return this.findById(id);
  }

  markAsReviewed(operator: string, remark?: string): ScoreWeight[] {
    const stmt = db.prepare(`
      UPDATE score_weight 
      SET reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, remark = ?, updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(operator, remark || null);
    return this.findAll();
  }

  isAllReviewed(): boolean {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM score_weight 
      WHERE reviewed_by IS NULL OR reviewed_at IS NULL
    `);
    const row = stmt.get() as { count: number };
    return row.count === 0;
  }

  getReviewInfo(): { reviewedBy: string | null; reviewedAt: string | null; remark: string | null } | null {
    const stmt = db.prepare('SELECT reviewed_by, reviewed_at, remark FROM score_weight LIMIT 1');
    const row = stmt.get() as any;
    return row ? {
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      remark: row.remark,
    } : null;
  }

  private mapToModel(row: any): ScoreWeight {
    return {
      id: row.id,
      dimension: row.dimension,
      weight: row.weight,
      description: row.description,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      remark: row.remark,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const weightRepository = new WeightRepository();
