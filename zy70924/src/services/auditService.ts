import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';

export const logAction = (params: {
  batch_id?: string;
  student_id?: string;
  certificate_id?: string;
  action: string;
  details?: string;
  operator: string;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO audit_logs (id, batch_id, student_id, certificate_id, action, details, operator, operated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, params.batch_id || null, params.student_id || null, params.certificate_id || null,
       params.action, params.details || null, params.operator, now],
      (err) => err ? reject(err) : resolve()
    );
  });
};

export const addReviewRecord = (params: {
  record_type: 'attendance' | 'homework' | 'certificate';
  record_id: string;
  batch_id: string;
  student_id: string;
  action: string;
  reason: string;
  processed_by: string;
  previous_status?: string;
  new_status?: string;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO record_reviews (id, record_type, record_id, batch_id, student_id, action, reason, processed_by, processed_at, previous_status, new_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, params.record_type, params.record_id, params.batch_id, params.student_id,
       params.action, params.reason, params.processed_by, now, params.previous_status || null, params.new_status || null],
      (err) => err ? reject(err) : resolve()
    );
  });
};

export const getAuditLogs = (filters: {
  batch_id?: string;
  student_id?: string;
  certificate_id?: string;
}): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    const params: any[] = [];
    
    if (filters.batch_id) {
      sql += ` AND batch_id = ?`;
      params.push(filters.batch_id);
    }
    if (filters.student_id) {
      sql += ` AND student_id = ?`;
      params.push(filters.student_id);
    }
    if (filters.certificate_id) {
      sql += ` AND certificate_id = ?`;
      params.push(filters.certificate_id);
    }
    sql += ` ORDER BY operated_at DESC`;
    
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
};

export const getReviewHistory = (record_type: string, record_id: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM record_reviews WHERE record_type = ? AND record_id = ? ORDER BY processed_at DESC`,
      [record_type, record_id],
      (err, rows) => err ? reject(err) : resolve(rows)
    );
  });
};
