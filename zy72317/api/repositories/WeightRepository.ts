import db from '../db';
import type { ScoreWeight } from '../../shared/types';

const DEFAULT_WEIGHT_BATCH_ID = 'weight-batch-default';

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

    db.prepare(`
      UPDATE weight_batch 
      SET reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, remark = ?
      WHERE id = ?
    `).run(operator, remark || null, DEFAULT_WEIGHT_BATCH_ID);

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
    const stmt = db.prepare(`
      SELECT reviewed_by, reviewed_at, remark 
      FROM weight_batch 
      WHERE id = ? 
      LIMIT 1
    `);
    const row = stmt.get(DEFAULT_WEIGHT_BATCH_ID) as any;
    if (!row) {
      const fallback = db.prepare('SELECT reviewed_by, reviewed_at, remark FROM score_weight LIMIT 1').get() as any;
      return fallback ? {
        reviewedBy: fallback.reviewed_by,
        reviewedAt: fallback.reviewed_at,
        remark: fallback.remark,
      } : null;
    }
    return {
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      remark: row.remark,
    };
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
