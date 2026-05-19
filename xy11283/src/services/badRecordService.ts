import { runQuery, getQuery, allQuery } from '../database';
import { BadRecord, BadRecordStatus } from '../models';
import { createAuditLog } from './auditService';
import { maskSensitiveData } from '../utils/security';

export async function createBadRecord(
  record: Omit<BadRecord, 'id' | 'created_at' | 'resolved_at'>
): Promise<BadRecord> {
  const result = await runQuery(
    `INSERT INTO bad_records (source_type, source_file, row_number, original_data, error_type, error_message, suggestion, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.source_type,
      record.source_file,
      record.row_number,
      record.original_data,
      record.error_type,
      record.error_message,
      record.suggestion,
      record.status || 'pending'
    ]
  );

  const badRecord = await getBadRecordById(result.lastID);
  
  await createAuditLog(
    'bad_record',
    result.lastID,
    'create',
    null,
    badRecord,
    'system',
    '系统'
  );

  return badRecord;
}

export async function getBadRecordById(id: number): Promise<BadRecord> {
  return await getQuery('SELECT * FROM bad_records WHERE id = ?', [id]);
}

export async function getBadRecords(
  status?: BadRecordStatus,
  sourceType?: string,
  limit: number = 100,
  offset: number = 0
): Promise<BadRecord[]> {
  let sql = 'SELECT * FROM bad_records WHERE 1=1';
  const params: any[] = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (sourceType) {
    sql += ' AND source_type = ?';
    params.push(sourceType);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const records = await allQuery(sql, params);
  return records.map(r => maskSensitiveData(r));
}

export async function resolveBadRecord(
  id: number,
  correctedData: string,
  operatorId?: string,
  operatorName?: string
): Promise<BadRecord> {
  const oldRecord = await getBadRecordById(id);

  await runQuery(
    `UPDATE bad_records SET status = 'resolved', corrected_data = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [correctedData, id]
  );

  const updatedRecord = await getBadRecordById(id);

  await createAuditLog(
    'bad_record',
    id,
    'resolve',
    oldRecord,
    updatedRecord,
    operatorId,
    operatorName
  );

  return updatedRecord;
}

export async function ignoreBadRecord(
  id: number,
  operatorId?: string,
  operatorName?: string
): Promise<BadRecord> {
  const oldRecord = await getBadRecordById(id);

  await runQuery(
    `UPDATE bad_records SET status = 'ignored', resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [id]
  );

  const updatedRecord = await getBadRecordById(id);

  await createAuditLog(
    'bad_record',
    id,
    'ignore',
    oldRecord,
    updatedRecord,
    operatorId,
    operatorName
  );

  return updatedRecord;
}

export async function getBadRecordStats(): Promise<any> {
  return await allQuery(`
    SELECT 
      status,
      source_type,
      error_type,
      COUNT(*) as count
    FROM bad_records
    GROUP BY status, source_type, error_type
    ORDER BY count DESC
  `);
}
