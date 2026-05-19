import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { run, get, all } from '../db';
import { Batch, CriticalValueRecord, CallbackRecord, DutyRecord, ProcessResult, FailedRecord } from '../types';
import { calculateFileHash } from './parser.service';
import { processRecordWithRules } from './rules-engine.service';

export const checkDuplicateBatch = async (fileHash: string): Promise<Batch | null> => {
  const existing = await get<Batch>(
    'SELECT * FROM batches WHERE file_hash = ? AND status != ?',
    [fileHash, 'failed']
  );
  return existing || null;
};

export const createBatch = async (
  type: 'critical_value' | 'callback' | 'duty',
  fileName: string,
  filePath: string
): Promise<{ batch: Batch; isDuplicate: boolean; existingBatch?: Batch }> => {
  const fileHash = calculateFileHash(filePath);
  const existingBatch = await checkDuplicateBatch(fileHash);

  if (existingBatch) {
    return { batch: existingBatch, isDuplicate: true, existingBatch };
  }

  const batchId = uuidv4();
  const batchNo = `BATCH-${type.toUpperCase()}-${dayjs().format('YYYYMMDDHHmmss')}`;

  const batch: Batch = {
    id: batchId,
    batchNo,
    type,
    fileName,
    fileHash,
    recordCount: 0,
    processedCount: 0,
    status: 'uploaded',
    createdAt: dayjs().toISOString()
  };

  await run(
    `INSERT INTO batches (id, batch_no, type, file_name, file_hash, record_count, processed_count, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [batch.id, batch.batchNo, batch.type, batch.fileName, batch.fileHash, batch.recordCount, batch.processedCount, batch.status, batch.createdAt]
  );

  return { batch, isDuplicate: false };
};

export const updateBatchStatus = async (
  batchId: string,
  status: Batch['status'],
  recordCount?: number,
  processedCount?: number
): Promise<void> => {
  const updates: string[] = ['status = ?'];
  const params: any[] = [status];

  if (recordCount !== undefined) {
    updates.push('record_count = ?');
    params.push(recordCount);
  }
  if (processedCount !== undefined) {
    updates.push('processed_count = ?');
    params.push(processedCount);
  }

  if (status === 'completed' || status === 'failed') {
    updates.push('processed_at = ?');
    params.push(dayjs().toISOString());
  }

  params.push(batchId);

  await run(
    `UPDATE batches SET ${updates.join(', ')} WHERE id = ?`,
    params
  );
};

export const saveCriticalValueRecords = async (records: CriticalValueRecord[]): Promise<void> => {
  for (const record of records) {
    await run(
      `INSERT INTO critical_values 
       (id, batch_id, patient_id, patient_name, test_item, test_value, unit, reference_range, 
        test_time, report_time, department, ward, bed_no, status, failure_reason, suggestion, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.batchId,
        record.patientId,
        record.patientName,
        record.testItem,
        record.testValue,
        record.unit,
        record.referenceRange,
        record.testTime,
        record.reportTime,
        record.department,
        record.ward,
        record.bedNo,
        record.status,
        record.failureReason || null,
        record.suggestion || null,
        record.source,
        record.createdAt
      ]
    );
  }
};

export const saveCallbackRecords = async (records: CallbackRecord[]): Promise<void> => {
  for (const record of records) {
    await run(
      `INSERT INTO callback_records 
       (id, batch_id, critical_value_id, patient_id, patient_name, callback_time, callback_person, 
        callback_phone, receiver, receiver_phone, callback_content, callback_result, failure_reason, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.batchId,
        record.criticalValueId || null,
        record.patientId,
        record.patientName,
        record.callbackTime,
        record.callbackPerson,
        record.callbackPhone,
        record.receiver,
        record.receiverPhone,
        record.callbackContent,
        record.callbackResult,
        record.failureReason,
        record.source,
        record.createdAt
      ]
    );
  }
};

export const saveDutyRecords = async (records: DutyRecord[]): Promise<void> => {
  for (const record of records) {
    await run(
      `INSERT INTO duty_records 
       (id, batch_id, date, shift, department, doctor_name, doctor_phone, start_time, end_time, is_on_duty, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.batchId,
        record.date,
        record.shift,
        record.department,
        record.doctorName,
        record.doctorPhone,
        record.startTime,
        record.endTime,
        record.isOnDuty ? 1 : 0,
        record.source,
        record.createdAt
      ]
    );
  }
};

export const processCriticalValueBatch = async (
  batchId: string,
  records: CriticalValueRecord[]
): Promise<ProcessResult> => {
  await updateBatchStatus(batchId, 'processing', records.length, 0);

  const allCallbacks = await all<CallbackRecord>('SELECT * FROM callback_records');
  const allDuties = await all<DutyRecord>('SELECT * FROM duty_records');

  const normal: CriticalValueRecord[] = [];
  const pending: CriticalValueRecord[] = [];
  const failed: FailedRecord[] = [];

  for (let i = 0; i < records.length; i++) {
    const result = await processRecordWithRules(records[i], records, allCallbacks, allDuties);
    
    if (result.status === 'normal') {
      normal.push(result.record as CriticalValueRecord);
    } else if (result.status === 'pending') {
      pending.push(result.record as CriticalValueRecord);
    } else {
      failed.push(result.record as FailedRecord);
    }

    await updateBatchStatus(batchId, 'processing', records.length, i + 1);
  }

  const allRecords = [...normal, ...pending, ...failed];
  await saveCriticalValueRecords(allRecords);

  await updateBatchStatus(batchId, 'completed', records.length, records.length);

  return {
    normal,
    pending,
    failed,
    batchId,
    statistics: {
      total: records.length,
      normal: normal.length,
      pending: pending.length,
      failed: failed.length
    }
  };
};

export const getBatchById = async (batchId: string): Promise<Batch | null> => {
  return await get<Batch>('SELECT * FROM batches WHERE id = ?', [batchId]);
};

export const getBatchRecords = async (batchId: string, status?: string) => {
  let sql = 'SELECT * FROM critical_values WHERE batch_id = ?';
  const params: any[] = [batchId];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  return await all(sql, params);
};

export const getAllBatches = async (limit: number = 50): Promise<Batch[]> => {
  return await all<Batch>('SELECT * FROM batches ORDER BY created_at DESC LIMIT ?', [limit]);
};
