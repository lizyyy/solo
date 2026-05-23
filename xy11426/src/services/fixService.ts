import { getDatabase } from '../db/database';
import { now } from '../utils';
import { logAudit } from './auditService';
import { RecordStatus } from '../types';

export interface FixRecordOptions {
  recordId: string;
  field: string;
  newValue: string;
  operator: string;
  reason: string;
}

export interface FixResult {
  recordId: string;
  originalLineNo: number;
  visitorName: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export function fixRecord(options: FixRecordOptions): FixResult {
  const db = getDatabase();
  
  const record = db.prepare(`
    SELECT * FROM visitor_records WHERE id = ?
  `).get(options.recordId) as any;

  if (!record) {
    throw new Error(`记录不存在: ${options.recordId}`);
  }

  const fieldMap: Record<string, string> = {
    'visitorName': 'visitor_name',
    'visitorPhone': 'visitor_phone',
    'idCard': 'id_card',
    'plateNumber': 'plate_number',
    'visitDate': 'visit_date',
    'startTime': 'start_time',
    'endTime': 'end_time',
  };

  const dbField = fieldMap[options.field] || options.field;
  const oldValue = (record as any)[dbField] || '';

  db.prepare(`
    UPDATE visitor_records 
    SET ${dbField} = ?, status = ?, updated_at = ? 
    WHERE id = ?
  `).run(options.newValue, RecordStatus.FIXED, now(), options.recordId);

  logAudit({
    recordId: options.recordId,
    batchId: record.batch_id,
    operator: options.operator,
    action: 'fix_record',
    oldValue: { [dbField]: oldValue },
    newValue: { [dbField]: options.newValue, reason: options.reason }
  });

  return {
    recordId: options.recordId,
    originalLineNo: record.original_line_no,
    visitorName: record.visitor_name,
    field: options.field,
    oldValue,
    newValue: options.newValue,
    reason: options.reason
  };
}

export function batchFix(batchId: string, fixes: FixRecordOptions[]): FixResult[] {
  const results: FixResult[] = [];
  
  for (const fix of fixes) {
    try {
      const result = fixRecord(fix);
      results.push(result);
    } catch (error) {
      console.error(`修复记录 ${fix.recordId} 失败:`, (error as Error).message);
    }
  }

  const db = getDatabase();
  const fixedCount = db.prepare(`
    SELECT COUNT(*) as count FROM visitor_records 
    WHERE batch_id = ? AND status = ?
  `).get(batchId, RecordStatus.FIXED) as any;

  db.prepare(`
    UPDATE import_batches 
    SET status = 'fixed', updated_at = ? 
    WHERE id = ?
  `).run(now(), batchId);

  logAudit({
    batchId,
    operator: fixes[0]?.operator || 'system',
    action: 'batch_fix',
    newValue: { fixedCount: fixedCount?.count || results.length }
  });

  return results;
}

export function getFixedRecords(batchId: string): any[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT 
      vr.*,
      al.old_value,
      al.new_value
    FROM visitor_records vr
    JOIN audit_logs al ON vr.id = al.record_id
    WHERE vr.batch_id = ? AND vr.status = ? AND al.action = 'fix_record'
    ORDER BY vr.original_line_no
  `).all(batchId, RecordStatus.FIXED);
}

export function autoFixBySuggestion(batchId: string, operator: string): FixResult[] {
  const db = getDatabase();
  const failedRecords = db.prepare(`
    SELECT * FROM visitor_records 
    WHERE batch_id = ? AND status = ?
  `).all(batchId, RecordStatus.INVALID) as any[];

  const fixes: FixRecordOptions[] = [];

  for (const record of failedRecords) {
    if (!record.check_result) continue;

    const checkResults = JSON.parse(record.check_result);
    
    for (const check of checkResults) {
      if (check.message === '开始时间晚于结束时间') {
        fixes.push({
          recordId: record.id,
          field: 'endTime',
          newValue: '23:59:59',
          operator,
          reason: '自动修复：将结束时间设为当天23:59:59'
        });
      }
      
      if (check.message.includes('手机号格式不正确') && record.visitor_phone) {
        const cleanPhone = record.visitor_phone.replace(/\D/g, '');
        if (cleanPhone.length === 11) {
          fixes.push({
            recordId: record.id,
            field: 'visitorPhone',
            newValue: cleanPhone,
            operator,
            reason: '自动修复：清除手机号中的非数字字符'
          });
        }
      }
    }
  }

  return batchFix(batchId, fixes);
}
