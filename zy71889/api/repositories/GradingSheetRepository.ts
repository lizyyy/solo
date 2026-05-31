import { getDb } from '../db/database.js';
import type { GradingSheet, GradingItem } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class GradingSheetRepository {
  private db = getDb();

  findByBatchId(batchId: string): GradingSheet | null {
    const row = this.db
      .prepare('SELECT * FROM grading_sheets WHERE batch_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(batchId) as any;
    return row ? this.mapRowToGradingSheet(row) : null;
  }

  findById(id: string): GradingSheet | null {
    const row = this.db
      .prepare('SELECT * FROM grading_sheets WHERE id = ?')
      .get(id) as any;
    return row ? this.mapRowToGradingSheet(row) : null;
  }

  create(data: {
    batchId: string;
    createdAt: string;
    totalScore: number;
    maxScore: number;
    items: GradingItem[];
    finalComment: string;
  }): GradingSheet {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO grading_sheets (id, batch_id, created_at, total_score, max_score, items, final_comment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.batchId,
        data.createdAt,
        data.totalScore,
        data.maxScore,
        JSON.stringify(data.items),
        data.finalComment
      );
    return this.findById(id)!;
  }

  private mapRowToGradingSheet(row: any): GradingSheet {
    return {
      id: row.id,
      batchId: row.batch_id,
      createdAt: row.created_at,
      totalScore: row.total_score,
      maxScore: row.max_score,
      items: JSON.parse(row.items),
      finalComment: row.final_comment,
    };
  }
}
