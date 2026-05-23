import { getDatabase } from '../db/database';
import { generateId, now, validatePhone, validateIdCard, validatePlateNumber, isAfter, isBefore, parseDate } from '../utils';
import { logAudit } from './auditService';
import { createTask } from './taskService';
import { RecordStatus } from '../types';

export interface CheckRule {
  name: string;
  type: string;
  check: (record: any) => { passed: boolean; message: string; suggestion?: string };
}

export interface CheckResult {
  recordId: string;
  originalLineNo: number;
  visitorName: string;
  checkType: string;
  passed: boolean;
  message: string;
  suggestion?: string;
}

export const checkRules: CheckRule[] = [
  {
    name: 'phone_format',
    type: 'format',
    check: (record) => {
      if (!record.visitor_phone) {
        return { passed: false, message: '手机号为空', suggestion: '请补充访客手机号' };
      }
      if (!validatePhone(record.visitor_phone)) {
        return { passed: false, message: '手机号格式不正确', suggestion: '请检查手机号格式' };
      }
      return { passed: true, message: '手机号格式正确' };
    }
  },
  {
    name: 'idcard_format',
    type: 'format',
    check: (record) => {
      if (!record.id_card) {
        return { passed: true, message: '身份证号为空（非必填）' };
      }
      if (!validateIdCard(record.id_card)) {
        return { passed: false, message: '身份证号格式不正确', suggestion: '请检查身份证号格式' };
      }
      return { passed: true, message: '身份证号格式正确' };
    }
  },
  {
    name: 'plate_format',
    type: 'format',
    check: (record) => {
      if (!record.plate_number) {
        return { passed: true, message: '车牌号为空（非必填）' };
      }
      if (!validatePlateNumber(record.plate_number)) {
        return { passed: false, message: '车牌号格式不正确', suggestion: '请检查车牌号格式' };
      }
      return { passed: true, message: '车牌号格式正确' };
    }
  },
  {
    name: 'date_required',
    type: 'required',
    check: (record) => {
      if (!record.visit_date) {
        return { passed: false, message: '访问日期为空', suggestion: '请补充访问日期' };
      }
      return { passed: true, message: '访问日期已填写' };
    }
  },
  {
    name: 'time_range',
    type: 'logic',
    check: (record) => {
      if (!record.start_time || !record.end_time) {
        return { passed: true, message: '时间不完整，跳过校验' };
      }
      const start = parseDate(record.visit_date + ' ' + record.start_time);
      const end = parseDate(record.visit_date + ' ' + record.end_time);
      if (start.isAfter(end)) {
        return { passed: false, message: '开始时间晚于结束时间', suggestion: '请调整访问时间范围' };
      }
      return { passed: true, message: '时间范围正确' };
    }
  },
  {
    name: 'cross_day_permission',
    type: 'logic',
    check: (record) => {
      if (!record.start_time || !record.end_time) {
        return { passed: true, message: '时间不完整，跳过跨天校验' };
      }
      const startStr = record.visit_date + ' ' + record.start_time;
      const endStr = record.visit_date + ' ' + record.end_time;
      
      const start = parseDate(startStr);
      const end = parseDate(endStr);
      
      if (end.isBefore(start, 'day')) {
        return { 
          passed: false, 
          message: '疑似跨天权限未收回', 
          suggestion: '请核实该访客权限是否已收回，或确认是否为临时放行跨天' 
        };
      }
      
      if (record.gate_passed === 1 && record.pass_time) {
        const passTime = parseDate(record.pass_time);
        const endTime = parseDate(endStr);
        if (passTime.isAfter(endTime.add(1, 'day'))) {
          return { 
            passed: false, 
            message: '闸机记录超过权限结束时间24小时以上', 
            suggestion: '请核实该访客权限是否已按时收回' 
          };
        }
      }
      
      return { passed: true, message: '跨天权限检查通过' };
    }
  },
  {
    name: 'name_required',
    type: 'required',
    check: (record) => {
      if (!record.visitor_name || record.visitor_name === '未知') {
        return { passed: false, message: '访客姓名为空或未知', suggestion: '请补充访客姓名' };
      }
      return { passed: true, message: '访客姓名已填写' };
    }
  }
];

export function saveCheckResult(
  batchId: string,
  recordId: string,
  checkType: string,
  passed: boolean,
  message: string
): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO check_results (
      id, batch_id, record_id, check_type, passed, message, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    generateId(),
    batchId,
    recordId,
    checkType,
    passed ? 1 : 0,
    message,
    now()
  );
}

export function checkRecord(record: any): CheckResult[] {
  const results: CheckResult[] = [];

  for (const rule of checkRules) {
    const result = rule.check(record);
    results.push({
      recordId: record.id,
      originalLineNo: record.original_line_no,
      visitorName: record.visitor_name,
      checkType: rule.type,
      passed: result.passed,
      message: result.message,
      suggestion: result.suggestion
    });

    saveCheckResult(
      record.batch_id,
      record.id,
      rule.name,
      result.passed,
      result.message
    );
  }

  return results;
}

export function checkBatch(batchId: string, operator: string): {
  total: number;
  valid: number;
  invalid: number;
  failures: CheckResult[];
} {
  const db = getDatabase();
  const records = db.prepare(`
    SELECT * FROM visitor_records WHERE batch_id = ?
  `).all(batchId) as any[];

  const taskId = createTask({
    batchId,
    taskType: 'check_batch',
    maxRetries: 2
  });

  let valid = 0;
  let invalid = 0;
  const allFailures: CheckResult[] = [];

  for (const record of records) {
    const results = checkRecord(record);
    const hasFailure = results.some(r => !r.passed);
    
    if (hasFailure) {
      invalid++;
      const recordFailures = results.filter(r => !r.passed);
      allFailures.push(...recordFailures);
      
      db.prepare(`
        UPDATE visitor_records 
        SET status = ?, check_result = ?, updated_at = ? 
        WHERE id = ?
      `).run(
        RecordStatus.INVALID,
        JSON.stringify(recordFailures),
        now(),
        record.id
      );
    } else {
      valid++;
      db.prepare(`
        UPDATE visitor_records 
        SET status = ?, updated_at = ? 
        WHERE id = ?
      `).run(RecordStatus.VALID, now(), record.id);
    }
  }

  db.prepare(`
    UPDATE import_batches 
    SET valid_records = ?, invalid_records = ?, status = 'checked', updated_at = ? 
    WHERE id = ?
  `).run(valid, invalid, now(), batchId);

  logAudit({
    batchId,
    operator,
    action: 'check_batch',
    newValue: { total: records.length, valid, invalid }
  });

  return {
    total: records.length,
    valid,
    invalid,
    failures: allFailures
  };
}

export function getRecordCheckResults(recordId: string): any[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM check_results 
    WHERE record_id = ? 
    ORDER BY created_at DESC
  `).all(recordId);
}

export function getBatchCheckResults(batchId: string, passedOnly?: boolean): any[] {
  const db = getDatabase();
  
  if (passedOnly !== undefined) {
    return db.prepare(`
      SELECT * FROM check_results 
      WHERE batch_id = ? AND passed = ? 
      ORDER BY created_at DESC
    `).all(batchId, passedOnly ? 1 : 0);
  }
  
  return db.prepare(`
    SELECT * FROM check_results 
    WHERE batch_id = ? 
    ORDER BY created_at DESC
  `).all(batchId);
}

export function getFailedRecords(batchId: string): any[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT vr.*, cr.message as check_message
    FROM visitor_records vr
    JOIN check_results cr ON vr.id = cr.record_id
    WHERE vr.batch_id = ? AND vr.status = ? AND cr.passed = 0
    GROUP BY vr.id
    ORDER BY vr.original_line_no
  `).all(batchId, RecordStatus.INVALID);
}

export function checkCrossSourceConsistency(): {
  total: number;
  inconsistent: number;
  details: any[];
} {
  const db = getDatabase();
  
  const records = db.prepare(`
    SELECT 
      plate_number,
      GROUP_CONCAT(DISTINCT source_type) as sources,
      GROUP_CONCAT(DISTINCT visit_date) as dates,
      COUNT(*) as count
    FROM visitor_records
    WHERE plate_number IS NOT NULL AND plate_number != ''
    GROUP BY plate_number
    HAVING count > 1
  `).all() as any[];

  const details: any[] = [];
  
  for (const record of records) {
    const sources = record.sources.split(',');
    if (sources.length > 1) {
      const sourceRecords = db.prepare(`
        SELECT * FROM visitor_records 
        WHERE plate_number = ? 
        ORDER BY visit_date
      `).all(record.plate_number);
      
      details.push({
        plateNumber: record.plate_number,
        sources,
        records: sourceRecords
      });
    }
  }

  return {
    total: records.length,
    inconsistent: details.length,
    details
  };
}
