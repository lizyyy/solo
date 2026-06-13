import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { records } from '../database';
import { AnnotationRecord, ReviewStatus, ImportResult } from '../types';
import { detectConflict } from './conflictDetector';
import {
  maskPhone,
  maskText,
  checkPhoneLeaked,
  auditRecordPhones,
  getPhoneLast4,
} from './maskService';

function readAllRecords(): AnnotationRecord[] {
  return records.getAll();
}

export function getRecords(params: {
  page?: number;
  pageSize?: number;
  status?: ReviewStatus;
  keyword?: string;
}): { records: AnnotationRecord[]; total: number } {
  const { page = 1, pageSize = 20, status, keyword } = params;
  let allRecords = readAllRecords();

  if (status) {
    allRecords = allRecords.filter((r) => r.review_status === status);
  }

  if (keyword) {
    const kw = keyword.toLowerCase();
    allRecords = allRecords.filter(
      (r) =>
        r.user_query.toLowerCase().includes(kw) ||
        r.annotator_comment.toLowerCase().includes(kw) ||
        r.session_id.toLowerCase().includes(kw)
    );
  }

  allRecords.sort((a, b) => b.created_at - a.created_at);

  const total = allRecords.length;
  const offset = (page - 1) * pageSize;
  const pagedRecords = allRecords.slice(offset, offset + pageSize);

  return { records: pagedRecords, total };
}

export function getRecordById(id: string): AnnotationRecord | undefined {
  return records.getById(id);
}

export function createRecord(data: Partial<AnnotationRecord>): AnnotationRecord {
  const now = Date.now();
  const id = data.id || uuidv4();

  const record: AnnotationRecord = {
    id,
    session_id: data.session_id || `sess_${Date.now()}`,
    user_query: data.user_query || '',
    annotator_comment: data.annotator_comment || '',
    model_output: data.model_output || '',
    phone_number: data.phone_number || '',
    is_intercepted: data.is_intercepted ?? false,
    review_status: data.review_status || ReviewStatus.PENDING,
    conflict_evidence: data.conflict_evidence,
    created_at: now,
    updated_at: now,
    imported_from: data.imported_from || 'manual',
    version: 1,
  };

  const conflict = detectConflict(record);
  if (conflict) {
    record.review_status = ReviewStatus.CONFLICT;
    record.conflict_evidence = JSON.stringify(conflict.evidence);
  }

  records.add(record);
  return record;
}

export function updateRecord(id: string, data: Partial<AnnotationRecord>): AnnotationRecord | undefined {
  const existing = records.getById(id);
  if (!existing) return undefined;

  const now = Date.now();
  const updated: AnnotationRecord = {
    ...existing,
    ...data,
    updated_at: now,
    version: existing.version + 1,
  };

  const conflict = detectConflict(updated);
  if (conflict) {
    updated.review_status = ReviewStatus.CONFLICT;
    updated.conflict_evidence = JSON.stringify(conflict.evidence);
  } else if (updated.review_status === ReviewStatus.CONFLICT) {
    updated.review_status = ReviewStatus.PENDING;
    updated.conflict_evidence = undefined;
  }

  records.update(id, updated);
  return records.getById(id);
}

export function confirmRecord(id: string): AnnotationRecord | undefined {
  return updateRecord(id, { review_status: ReviewStatus.CONFIRMED });
}

export function rejectRecord(id: string): AnnotationRecord | undefined {
  return updateRecord(id, { review_status: ReviewStatus.REJECTED });
}

export function sendToAlgorithmReview(id: string): AnnotationRecord | undefined {
  return updateRecord(id, { review_status: ReviewStatus.NEED_ALGORITHM_REVIEW });
}

export function importFromExcel(buffer: Buffer, fileName: string): ImportResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet) as any[];

  const result: ImportResult = {
    total: rows.length,
    success: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: [],
  };

  const existingSessions = records.getSessionIds();

  rows.forEach((row, index) => {
    try {
      const sessionId = row['会话ID'] || row['session_id'] || row['SessionId'] || `import_${Date.now()}_${index}`;

      if (existingSessions.has(sessionId)) {
        result.duplicates++;
        return;
      }
      existingSessions.add(sessionId);

      createRecord({
        session_id: sessionId,
        user_query: row['用户问题'] || row['user_query'] || row['query'] || '',
        annotator_comment: row['标注员留言'] || row['annotator_comment'] || row['comment'] || '',
        model_output: row['模型输出'] || row['model_output'] || row['output'] || '',
        phone_number: row['手机号'] || row['phone_number'] || row['phone'] || '',
        is_intercepted: Boolean(row['是否拦截'] || row['is_intercepted'] || false),
        imported_from: fileName,
      });

      result.success++;
    } catch (e: any) {
      result.errors++;
      result.errorDetails.push(`第${index + 2}行: ${e.message}`);
    }
  });

  return result;
}

export function exportRecords(recordIds?: string[]): Buffer {
  let allRecords = readAllRecords();
  if (recordIds && recordIds.length > 0) {
    allRecords = allRecords.filter((r) => recordIds.includes(r.id));
  }

  allRecords.sort((a, b) => b.created_at - a.created_at);

  const seenMaskedPhones = new Map<string, AnnotationRecord>();
  const duplicatePhoneRecords: string[] = [];

  allRecords.forEach((r) => {
    const masked = maskPhone(r.phone_number || '');
    if (masked && masked.includes('****')) {
      if (seenMaskedPhones.has(masked)) {
        duplicatePhoneRecords.push(r.id);
      } else {
        seenMaskedPhones.set(masked, r);
      }
    }
  });

  const dedupedRecords = allRecords.filter((r) => !duplicatePhoneRecords.includes(r.id));

  let phoneLeakCount = 0;
  const exportData = dedupedRecords.map((r) => {
    const phoneAudits = auditRecordPhones({
      phone_number: r.phone_number,
      user_query: r.user_query,
      annotator_comment: r.annotator_comment,
      model_output: r.model_output,
    });
    const hasPhoneLeak = phoneAudits.length > 0;
    if (hasPhoneLeak) phoneLeakCount++;
    const leakLocations = phoneAudits.map((a) => `${a.fieldName}(${a.occurrences.length}个)`).join('、');
    const allLeakedLast4 = Array.from(
      new Set(phoneAudits.flatMap((a) => a.occurrences.map((o) => o.last4)))
    ).join(',');

    return {
      '记录ID': r.id,
      '会话ID': r.session_id,
      '用户问题（已脱敏）': maskText(r.user_query || ''),
      '标注员留言（已脱敏）': maskText(r.annotator_comment || ''),
      '模型输出片段（已脱敏）': maskText(r.model_output || ''),
      '手机号脱敏': maskPhone(r.phone_number || ''),
      '原始手机号后4位': getPhoneLast4(r.phone_number || ''),
      '是否拦截': r.is_intercepted ? '是' : '否',
      '审核状态': statusText(r.review_status),
      '是否存在手机号漏遮风险': hasPhoneLeak ? '是（需算法复核）' : '否',
      '漏遮溯源位置': leakLocations || '-',
      '漏遮手机号后4位汇总': allLeakedLast4 || '-',
      '导入来源': r.imported_from,
      '版本': r.version,
      '创建时间': new Date(r.created_at).toLocaleString('zh-CN'),
      '更新时间': new Date(r.updated_at).toLocaleString('zh-CN'),
    };
  });

  const summaryData = [
    { '汇总项': '原始记录总数', '数值': allRecords.length },
    { '汇总项': '按脱敏手机号去重后导出数', '数值': dedupedRecords.length },
    { '汇总项': '因同手机号重复被去重的记录数', '数值': duplicatePhoneRecords.length },
    { '汇总项': '存在手机号漏遮需算法复核数', '数值': phoneLeakCount },
  ];

  const wsRecords = XLSX.utils.json_to_sheet(exportData);
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, '导出汇总');
  XLSX.utils.book_append_sheet(wb, wsRecords, '越权拦截明细');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function statusText(status: ReviewStatus): string {
  const map: Record<ReviewStatus, string> = {
    [ReviewStatus.PENDING]: '待处理',
    [ReviewStatus.CONFLICT]: '存在冲突',
    [ReviewStatus.CONFIRMED]: '已确认',
    [ReviewStatus.REJECTED]: '已驳回',
    [ReviewStatus.NEED_ALGORITHM_REVIEW]: '待算法复核',
  };
  return map[status] || status;
}

export function getConflicts(): { record: AnnotationRecord; evidence: string[] }[] {
  const allRecords = readAllRecords();
  return allRecords
    .filter((r) => r.review_status === ReviewStatus.CONFLICT)
    .map((r) => ({
      record: r,
      evidence: r.conflict_evidence ? JSON.parse(r.conflict_evidence) : [],
    }));
}
