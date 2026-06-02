import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import type { SelfCheckResult, CheckType, CheckStatus } from '../../shared/types.js';

export class SelfCheckRepository {
  create(data: {
    batchId: string;
    checkType: CheckType;
    status: CheckStatus;
    message: string;
    affectedDetailIds: string[];
    checkMetadata: Record<string, any>;
  }): SelfCheckResult {
    const now = new Date().toISOString();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO self_check_results (
        id, batch_id, check_type, status, message,
        affected_detail_ids, check_metadata, checked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.batchId, data.checkType, data.status, data.message,
      JSON.stringify(data.affectedDetailIds), JSON.stringify(data.checkMetadata), now
    );
    return this.findById(id)!;
  }

  findById(id: string): SelfCheckResult | null {
    const row = db.prepare('SELECT * FROM self_check_results WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBatchId(batchId: string): SelfCheckResult[] {
    const rows = db.prepare(`
      SELECT * FROM self_check_results 
      WHERE batch_id = ? ORDER BY checked_at DESC
    `).all(batchId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findLatestByType(batchId: string, checkType: CheckType): SelfCheckResult | null {
    const row = db.prepare(`
      SELECT * FROM self_check_results 
      WHERE batch_id = ? AND check_type = ?
      ORDER BY checked_at DESC LIMIT 1
    `).get(batchId, checkType) as any;
    return row ? this.mapRow(row) : null;
  }

  deleteByBatchId(batchId: string): void {
    db.prepare('DELETE FROM self_check_results WHERE batch_id = ?').run(batchId);
  }

  private mapRow(row: any): SelfCheckResult {
    return {
      id: row.id,
      batchId: row.batch_id,
      checkType: row.check_type as CheckType,
      status: row.status as CheckStatus,
      message: row.message,
      affectedDetailIds: row.affected_detail_ids ? JSON.parse(row.affected_detail_ids) : [],
      checkMetadata: row.check_metadata ? JSON.parse(row.check_metadata) : {},
      checkedAt: row.checked_at
    };
  }
}

export default new SelfCheckRepository();
