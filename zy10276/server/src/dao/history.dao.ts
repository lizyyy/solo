import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessingHistory {
  id: string;
  violationId: string;
  action: string;
  operator: string;
  operatorId: string;
  remarks?: string;
  oldStatus?: string;
  newStatus?: string;
  createdAt: string;
}

export class ProcessingHistoryDAO {
  static getByViolationId(violationId: string): ProcessingHistory[] {
    const stmt = db.prepare(`
      SELECT 
        id, violation_id as violationId, action, operator, operator_id as operatorId,
        remarks, old_status as oldStatus, new_status as newStatus,
        created_at as createdAt
      FROM processing_history
      WHERE violation_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(violationId) as ProcessingHistory[];
  }

  static create(data: Omit<ProcessingHistory, 'id' | 'createdAt'>): ProcessingHistory {
    const id = uuidv4();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO processing_history (
        id, violation_id, action, operator, operator_id, remarks, old_status, new_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.violationId, data.action, data.operator, data.operatorId,
      data.remarks || null, data.oldStatus || null, data.newStatus || null, now
    );
    
    return {
      id,
      ...data,
      createdAt: now,
    } as ProcessingHistory;
  }
}

export default ProcessingHistoryDAO;
