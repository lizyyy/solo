import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { logAction, addReviewRecord, getReviewHistory } from './auditService';

export const processAttendanceRecord = async (params: {
  recordId: string;
  action: 'approve' | 'reject' | 'makeup_approve' | 'makeup_reject';
  reason: string;
  processedBy: string;
}): Promise<void> => {
  const record = await getRecordById('attendance_records', params.recordId);
  if (!record) throw new Error('记录不存在');
  
  let newStatus = record.status;
  
  switch (params.action) {
    case 'approve':
      newStatus = 'normal';
      break;
    case 'reject':
      newStatus = 'absent';
      break;
    case 'makeup_approve':
      newStatus = 'makeup_approved';
      break;
    case 'makeup_reject':
      newStatus = 'makeup_rejected';
      break;
  }
  
  const now = new Date().toISOString();
  const updateFields: any = { status: newStatus };
  
  if (params.action === 'makeup_approve') {
    updateFields.is_makeup = 1;
    updateFields.makeup_approved_by = params.processedBy;
    updateFields.makeup_approved_at = now;
    updateFields.makeup_reason = params.reason;
  }
  
  await new Promise<void>((resolve, reject) => {
    const setClauses = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updateFields), params.recordId];
    db.run(
      `UPDATE attendance_records SET ${setClauses} WHERE id = ?`,
      values,
      (err) => err ? reject(err) : resolve()
    );
  });
  
  await addReviewRecord({
    record_type: 'attendance',
    record_id: params.recordId,
    batch_id: record.batch_id,
    student_id: record.student_id,
    action: params.action,
    reason: params.reason,
    processed_by: params.processedBy,
    previous_status: record.status,
    new_status: newStatus
  });
  
  await logAction({
    batch_id: record.batch_id,
    student_id: record.student_id,
    action: `attendance_${params.action}`,
    details: params.reason,
    operator: params.processedBy
  });
};

export const processHomeworkRecord = async (params: {
  recordId: string;
  action: 'approve' | 'reject';
  reason: string;
  processedBy: string;
  newScore?: number;
}): Promise<void> => {
  const record = await getRecordById('homework_records', params.recordId);
  if (!record) throw new Error('记录不存在');
  
  const newStatus = params.action === 'approve' ? 'graded' : 'absent';
  
  await new Promise<void>((resolve, reject) => {
    db.run(
      `UPDATE homework_records SET status = ?, score = COALESCE(?, score) WHERE id = ?`,
      [newStatus, params.newScore || null, params.recordId],
      (err) => err ? reject(err) : resolve()
    );
  });
  
  await addReviewRecord({
    record_type: 'homework',
    record_id: params.recordId,
    batch_id: record.batch_id,
    student_id: record.student_id,
    action: params.action,
    reason: params.reason,
    processed_by: params.processedBy,
    previous_status: record.status,
    new_status: newStatus
  });
  
  await logAction({
    batch_id: record.batch_id,
    student_id: record.student_id,
    action: `homework_${params.action}`,
    details: params.reason,
    operator: params.processedBy
  });
};

export const returnBatchForRevision = async (
  batchId: string,
  reason: string,
  processedBy: string
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE batches SET status = 'returned', updated_at = ? WHERE id = ?`,
      [now, batchId],
      (err) => err ? reject(err) : resolve()
    );
  });
  
  await logAction({
    batch_id: batchId,
    action: 'batch_returned',
    details: reason,
    operator: processedBy
  });
};

const getRecordById = (table: string, id: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM ${table} WHERE id = ?`, [id], (err, row) => {
      err ? reject(err) : resolve(row);
    });
  });
};

export const getRecordWithHistory = async (
  recordType: 'attendance' | 'homework' | 'certificate',
  recordId: string
): Promise<any> => {
  const tableMap: Record<string, string> = {
    attendance: 'attendance_records',
    homework: 'homework_records',
    certificate: 'certificates'
  };
  
  const record = await getRecordById(tableMap[recordType], recordId);
  if (!record) return null;
  
  const history = await getReviewHistory(recordType, recordId);
  
  return {
    record,
    review_history: history
  };
};
