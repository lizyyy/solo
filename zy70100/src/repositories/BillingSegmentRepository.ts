import { getDb } from '../database';
import { BillingSegment } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class BillingSegmentRepository {
  private db = getDb();

  create(segment: Omit<BillingSegment, 'id'> & { id?: string }): BillingSegment {
    const id = segment.id || uuidv4();
    this.db.run(`
      INSERT INTO billing_segments (id, session_id, segment_type, start_time, end_time, actual_kwh, rate_id, unit_price, amount, is_refundable, refund_percentage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      segment.sessionId,
      segment.segmentType,
      segment.startTime.toISOString(),
      segment.endTime.toISOString(),
      segment.actualKwh,
      segment.rateId,
      segment.unitPrice,
      segment.amount,
      segment.isRefundable ? 1 : 0,
      segment.refundPercentage,
    ]);
    return { ...segment, id };
  }

  findById(id: string): BillingSegment | null {
    const stmt = this.db.prepare('SELECT * FROM billing_segments WHERE id = ?');
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return this.mapRowToSegment(row);
    }
    stmt.free();
    return null;
  }

  findBySessionId(sessionId: string): BillingSegment[] {
    const results: BillingSegment[] = [];
    const stmt = this.db.prepare('SELECT * FROM billing_segments WHERE session_id = ? ORDER BY start_time ASC');
    stmt.bind([sessionId]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      results.push(this.mapRowToSegment(row));
    }
    stmt.free();
    return results;
  }

  findBySessionIdAndType(sessionId: string, segmentType: 'ENERGY' | 'SERVICE'): BillingSegment[] {
    const results: BillingSegment[] = [];
    const stmt = this.db.prepare('SELECT * FROM billing_segments WHERE session_id = ? AND segment_type = ? ORDER BY start_time ASC');
    stmt.bind([sessionId, segmentType]);
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      results.push(this.mapRowToSegment(row));
    }
    stmt.free();
    return results;
  }

  private mapRowToSegment(row: any): BillingSegment {
    return {
      id: row.id,
      sessionId: row.session_id,
      segmentType: row.segment_type as 'ENERGY' | 'SERVICE',
      startTime: new Date(row.start_time),
      endTime: new Date(row.end_time),
      actualKwh: row.actual_kwh,
      rateId: row.rate_id,
      unitPrice: row.unit_price,
      amount: row.amount,
      isRefundable: row.is_refundable === 1,
      refundPercentage: row.refund_percentage,
    };
  }
}
