import db from '../utils/database';
import { ReviewRecord, ReviewCreate } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

class ReviewRepository {
  findByRecordId(recordId: string): ReviewRecord[] {
    const stmt = db.prepare(`
      SELECT 
        id, record_id as recordId, reviewer, status, comment,
        reviewed_at as reviewedAt
      FROM review_records
      WHERE record_id = ?
      ORDER BY reviewed_at DESC
    `);
    return stmt.all(recordId) as ReviewRecord[];
  }

  create(data: ReviewCreate): ReviewRecord {
    const id = uuidv4();
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const stmt = db.prepare(`
      INSERT INTO review_records (
        id, record_id, reviewer, status, comment, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.recordId, data.reviewer, data.status, data.comment || null, now);
    
    const getStmt = db.prepare(`
      SELECT 
        id, record_id as recordId, reviewer, status, comment,
        reviewed_at as reviewedAt
      FROM review_records WHERE id = ?
    `);
    return getStmt.get(id) as ReviewRecord;
  }

  findLatestByRecordId(recordId: string): ReviewRecord | undefined {
    const stmt = db.prepare(`
      SELECT 
        id, record_id as recordId, reviewer, status, comment,
        reviewed_at as reviewedAt
      FROM review_records
      WHERE record_id = ?
      ORDER BY reviewed_at DESC
      LIMIT 1
    `);
    return stmt.get(recordId) as ReviewRecord | undefined;
  }
}

export default new ReviewRepository();
