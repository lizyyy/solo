import db from '../db';
import { v4 as uuidv4 } from 'uuid';
import type { GapRecord, GapReviewInfo } from '../../shared/types';

export class GapRecordRepository {
  create(
    beforeLineNo: number,
    afterLineNo: number,
    missingCount: number,
    beforeRouteId: string | null,
    afterRouteId: string | null
  ): GapRecord {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO gap_record (id, before_line_no, after_line_no, missing_count, before_route_id, after_route_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, beforeLineNo, afterLineNo, missingCount, beforeRouteId, afterRouteId);
    return this.findById(id) as GapRecord;
  }

  findById(id: string): GapRecord | null {
    const stmt = db.prepare('SELECT * FROM gap_record WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapToModel(row) : null;
  }

  findAll(status?: 'open' | 'reviewed' | 'all'): GapRecord[] {
    let sql = 'SELECT * FROM gap_record';
    if (status && status !== 'all') {
      sql += " WHERE status = ?";
    }
    sql += ' ORDER BY detected_at DESC';
    const stmt = db.prepare(sql);
    const rows = status && status !== 'all' ? stmt.all(status) as any[] : stmt.all() as any[];
    return rows.map(row => this.mapToModel(row));
  }

  findOpenGaps(): GapRecord[] {
    return this.findAll('open');
  }

  countOpenGaps(): number {
    const stmt = db.prepare("SELECT COUNT(*) as count FROM gap_record WHERE status = 'open'");
    const row = stmt.get() as { count: number };
    return row.count;
  }

  reviewGap(
    id: string,
    reviewInfo: GapReviewInfo
  ): GapRecord | null {
    const stmt = db.prepare(`
      UPDATE gap_record 
      SET status = 'reviewed', review_info = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(reviewInfo), id);
    return this.findById(id);
  }

  closeAllOpenGaps(): number {
    const stmt = db.prepare("UPDATE gap_record SET status = 'closed_obsolete' WHERE status = 'open'");
    const result = stmt.run();
    return result.changes || 0;
  }

  private mapToModel(row: any): GapRecord {
    return {
      id: row.id,
      beforeLineNo: row.before_line_no,
      afterLineNo: row.after_line_no,
      missingCount: row.missing_count,
      beforeRouteId: row.before_route_id,
      afterRouteId: row.after_route_id,
      status: row.status as 'open' | 'reviewed',
      detectedAt: row.detected_at,
      reviewInfo: row.review_info ? JSON.parse(row.review_info) : null,
    };
  }
}

export const gapRecordRepository = new GapRecordRepository();
