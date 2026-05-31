import { getDb } from '../db/database.js';
import type { ManualConfirmation } from '../../shared/types.js';
import { v4 as uuidv4 } from 'uuid';

export class ManualConfirmationRepository {
  private db = getDb();

  findByBatchId(batchId: string): ManualConfirmation[] {
    const rows = this.db
      .prepare('SELECT * FROM manual_confirmations WHERE batch_id = ? ORDER BY timestamp ASC')
      .all(batchId) as any[];
    return rows.map(this.mapRowToManualConfirmation);
  }

  findById(id: string): ManualConfirmation | null {
    const row = this.db
      .prepare('SELECT * FROM manual_confirmations WHERE id = ?')
      .get(id) as any;
    return row ? this.mapRowToManualConfirmation(row) : null;
  }

  create(data: {
    batchId: string;
    timestamp: string;
    content: string;
    confirmer: string;
    relatedItemId?: string;
    relatedItemType?: ManualConfirmation['relatedItemType'];
  }): ManualConfirmation {
    const id = uuidv4();
    this.db
      .prepare(
        `INSERT INTO manual_confirmations (id, batch_id, timestamp, content, confirmer, related_item_id, related_item_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.batchId,
        data.timestamp,
        data.content,
        data.confirmer,
        data.relatedItemId || null,
        data.relatedItemType || null
      );
    return this.findById(id)!;
  }

  private mapRowToManualConfirmation(row: any): ManualConfirmation {
    return {
      id: row.id,
      batchId: row.batch_id,
      timestamp: row.timestamp,
      content: row.content,
      confirmer: row.confirmer,
      relatedItemId: row.related_item_id || undefined,
      relatedItemType: row.related_item_type || undefined,
    };
  }
}
