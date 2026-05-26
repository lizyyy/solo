import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { logAction } from './auditService';
import { Batch, BatchStatus } from '../types';

export const createBatch = async (params: {
  course_name: string;
  course_code: string;
  batch_number: string;
  start_date: string;
  end_date: string;
  created_by: string;
  rules?: {
    min_attendance_rate?: number;
    late_threshold_minutes?: number;
    late_penalty_score?: number;
    min_homework_score?: number;
    require_all_homework?: boolean;
  };
}): Promise<Batch> => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    db.serialize(() => {
      db.run(
        `INSERT INTO batches (id, course_name, course_code, batch_number, start_date, end_date, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [id, params.course_name, params.course_code, params.batch_number, params.start_date, params.end_date, params.created_by, now, now],
        async (err) => {
          if (err) return reject(err);
          
          const ruleId = uuidv4();
          const rules = params.rules || {};
          db.run(
            `INSERT INTO course_rules (id, batch_id, min_attendance_rate, late_threshold_minutes, late_penalty_score, min_homework_score, require_all_homework, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [ruleId, id, rules.min_attendance_rate || 0.8, rules.late_threshold_minutes || 30,
             rules.late_penalty_score || 0, rules.min_homework_score || 60,
             rules.require_all_homework !== false ? 1 : 0, now],
            async (ruleErr) => {
              if (ruleErr) return reject(ruleErr);
              
              await logAction({
                batch_id: id,
                action: 'create_batch',
                details: `创建批次: ${params.course_name} - ${params.batch_number}`,
                operator: params.created_by
              });
              
              resolve({
                id,
                course_name: params.course_name,
                course_code: params.course_code,
                batch_number: params.batch_number,
                start_date: params.start_date,
                end_date: params.end_date,
                status: 'pending',
                total_students: 0,
                created_by: params.created_by,
                created_at: now,
                updated_at: now
              });
            }
          );
        }
      );
    });
  });
};

export const updateBatchStatus = async (
  batchId: string,
  status: BatchStatus,
  operator: string,
  reason?: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE batches SET status = ?, updated_at = ? WHERE id = ?`,
      [status, now, batchId],
      async (err) => {
        if (err) return reject(err);
        await logAction({
          batch_id: batchId,
          action: `update_status_${status}`,
          details: reason || `更新批次状态为: ${status}`,
          operator
        });
        resolve();
      }
    );
  });
};

export const getBatch = (batchId: string): Promise<Batch | null> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM batches WHERE id = ?`, [batchId], (err, row) => {
      if (err) reject(err);
      else resolve(row as Batch || null);
    });
  });
};

export const listBatches = (filters?: {
  course_code?: string;
  status?: BatchStatus;
}): Promise<Batch[]> => {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM batches WHERE 1=1`;
    const params: any[] = [];
    
    if (filters?.course_code) {
      sql += ` AND course_code = ?`;
      params.push(filters.course_code);
    }
    if (filters?.status) {
      sql += ` AND status = ?`;
      params.push(filters.status);
    }
    sql += ` ORDER BY created_at DESC`;
    
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows as Batch[]));
  });
};

export const getBatchRules = (batchId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM course_rules WHERE batch_id = ?`, [batchId], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};
