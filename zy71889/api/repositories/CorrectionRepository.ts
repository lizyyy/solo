import { getDb } from '../db/database.js';
import type { Correction } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class CorrectionRepository {
  private db = getDb();

  findByBatchId(batchId: string): Correction[] {
    const rows = this.db
      .prepare('SELECT * FROM corrections WHERE batch_id = ? ORDER BY timestamp ASC')
      .all(batchId) as any[];
    return rows.map(this.mapRowToCorrection);
  }

  findById(id: string): Correction | null {
    const row = this.db
      .prepare('SELECT * FROM corrections WHERE id = ?')
      .get(id) as any;
    return row ? this.mapRowToCorrection(row) : null;
  }

  create(data: {
    batchId: string;
    timestamp: string;
    content: string;
    author: string;
    category: Correction['category'];
    points?: number;
  }): Correction {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO corrections (id, batch_id, timestamp, content, author, category, points)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.batchId,
        data.timestamp,
        data.content,
        data.author,
        data.category,
        data.points ?? null
      );
    return this.findById(id)!;
  }

  private mapRowToCorrection(row: any): Correction {
    return {
      id: row.id,
      batchId: row.batch_id,
      timestamp: row.timestamp,
      content: row.content,
      author: row.author,
      category: row.category,
      points: row.points ?? undefined,
    };
  }
}
