import { getDb } from '../db/database.js';
import type { ExperimentRecord } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class ExperimentRecordRepository {
  private db = getDb();

  findByBatchId(batchId: string): ExperimentRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM experiment_records WHERE batch_id = ? ORDER BY timestamp ASC')
      .all(batchId) as any[];
    return rows.map(this.mapRowToExperimentRecord);
  }

  findById(id: string): ExperimentRecord | null {
    const row = this.db
      .prepare('SELECT * FROM experiment_records WHERE id = ?')
      .get(id) as any;
    return row ? this.mapRowToExperimentRecord(row) : null;
  }

  create(data: {
    batchId: string;
    timestamp: string;
    type: ExperimentRecord['type'];
    content: string;
    author: string;
  }): ExperimentRecord {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO experiment_records (id, batch_id, timestamp, type, content, author)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, data.batchId, data.timestamp, data.type, data.content, data.author);
    return this.findById(id)!;
  }

  private mapRowToExperimentRecord(row: any): ExperimentRecord {
    return {
      id: row.id,
      batchId: row.batch_id,
      timestamp: row.timestamp,
      type: row.type,
      content: row.content,
      author: row.author,
    };
  }
}
