import db from '../utils/database';
import { TailAdjustment, TailAdjustmentCreate } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

class AdjustmentRepository {
  findAll(): TailAdjustment[] {
    const stmt = db.prepare(`
      SELECT 
        id, record_id as recordId, amount, reason,
        adjusted_by as adjustedBy, adjusted_at as adjustedAt,
        affects_reconciliation as affectsReconciliation
      FROM tail_adjustments
      ORDER BY adjusted_at DESC
    `);
    return stmt.all() as TailAdjustment[];
  }

  findByRecordId(recordId: string): TailAdjustment[] {
    const stmt = db.prepare(`
      SELECT 
        id, record_id as recordId, amount, reason,
        adjusted_by as adjustedBy, adjusted_at as adjustedAt,
        affects_reconciliation as affectsReconciliation
      FROM tail_adjustments
      WHERE record_id = ?
      ORDER BY adjusted_at DESC
    `);
    return stmt.all(recordId) as TailAdjustment[];
  }

  create(data: TailAdjustmentCreate): TailAdjustment {
    const id = uuidv4();
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const stmt = db.prepare(`
      INSERT INTO tail_adjustments (
        id, record_id, amount, reason, adjusted_by, adjusted_at, affects_reconciliation
      ) VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    stmt.run(id, data.recordId, data.amount, data.reason, data.adjustedBy, now);
    
    const getStmt = db.prepare(`
      SELECT 
        id, record_id as recordId, amount, reason,
        adjusted_by as adjustedBy, adjusted_at as adjustedAt,
        affects_reconciliation as affectsReconciliation
      FROM tail_adjustments WHERE id = ?
    `);
    return getStmt.get(id) as TailAdjustment;
  }

  findById(id: string): TailAdjustment | undefined {
    const stmt = db.prepare(`
      SELECT 
        id, record_id as recordId, amount, reason,
        adjusted_by as adjustedBy, adjusted_at as adjustedAt,
        affects_reconciliation as affectsReconciliation
      FROM tail_adjustments WHERE id = ?
    `);
    return stmt.get(id) as TailAdjustment | undefined;
  }

  deleteAllDemoData(): void {
    db.prepare('DELETE FROM tail_adjustments WHERE id LIKE "adj-%"').run();
  }
}

export default new AdjustmentRepository();
