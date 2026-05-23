import { v4 as uuidv4 } from 'uuid';
import { getDatabase, runSync, getSync, allSync } from '../database';
import { StatusTransition, BatchStatus } from '../types';

export class StatusTransitionRepository {
  private get db() {
    return getDatabase();
  }

  async create(data: {
    batchId: string;
    fromStatus: BatchStatus | null;
    toStatus: BatchStatus;
    reason: string;
    operator: string;
  }): Promise<StatusTransition> {
    const now = Date.now();
    const id = uuidv4();
    await runSync(this.db, `
      INSERT INTO status_transitions (
        id, batch_id, from_status, to_status, reason, operator, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      data.batchId,
      data.fromStatus,
      data.toStatus,
      data.reason,
      data.operator,
      now
    ]);
    return this.findById(id) as Promise<StatusTransition>;
  }

  async findById(id: string): Promise<StatusTransition | null> {
    const row = await getSync(this.db, 'SELECT * FROM status_transitions WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async findByBatchId(batchId: string): Promise<StatusTransition[]> {
    const rows = await allSync(this.db, 'SELECT * FROM status_transitions WHERE batch_id = ? ORDER BY created_at ASC', [batchId]);
    return rows.map(row => this.mapRow(row));
  }

  async findAll(): Promise<StatusTransition[]> {
    const rows = await allSync(this.db, 'SELECT * FROM status_transitions ORDER BY created_at DESC');
    return rows.map(row => this.mapRow(row));
  }

  private mapRow(row: any): StatusTransition {
    return {
      id: row.id,
      batchId: row.batch_id,
      fromStatus: row.from_status as BatchStatus | null,
      toStatus: row.to_status as BatchStatus,
      reason: row.reason,
      operator: row.operator,
      createdAt: row.created_at
    };
  }
}
