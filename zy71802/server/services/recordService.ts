import db from '../db';
import type { GuaranteeRecord, OperationLog, RecordStatus, RecordSource, ImportResult } from '../types';

const STATUS_LABELS: Record<RecordStatus, string> = {
  pending: '待处理',
  approved: '已通过',
  rejected: '已驳回',
  withdrawn: '已撤回',
  disputed: '待复核',
  completed: '已完成'
};

const SOURCE_LABELS: Record<RecordSource, string> = {
  approval_screenshot: '审批截图',
  review_daily: '复核日报',
  manual_entry: '手工录入',
  batch_import: '批量导入'
};

export const getStatusLabel = (status: RecordStatus): string => STATUS_LABELS[status] || status;
export const getSourceLabel = (source: RecordSource): string => SOURCE_LABELS[source] || source;

function logOperation(
  recordId: number,
  operation: string,
  operator: string,
  changes: Record<string, { old: any; new: any }>,
  reason?: string,
  oldStatus?: RecordStatus,
  newStatus?: RecordStatus
) {
  const changesStr = JSON.stringify(changes);
  db.prepare(`
    INSERT INTO operation_logs (recordId, operation, operator, oldStatus, newStatus, changes, reason, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(recordId, operation, operator, oldStatus, newStatus, changesStr, reason, new Date().toISOString());
}

export function findDuplicate(guaranteeNo: string, customerName: string, amount: number, excludeId?: number): GuaranteeRecord | null {
  let query = `
    SELECT * FROM guarantee_records 
    WHERE guaranteeNo = ? AND customerName = ? AND amount = ? AND status != 'withdrawn'
  `;
  const params: any[] = [guaranteeNo, customerName, amount];
  
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  
  query += ' ORDER BY createdAt DESC LIMIT 1';
  
  const result = db.prepare(query).get(...params);
  return result as GuaranteeRecord || null;
}

export function createRecord(
  data: Omit<GuaranteeRecord, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDuplicate' | 'duplicateWith'>,
  operator: string
): { record: GuaranteeRecord; isDuplicate: boolean; duplicateWith?: number } {
  const now = new Date().toISOString();
  
  const duplicate = findDuplicate(data.guaranteeNo, data.customerName, data.amount);
  
  const isDuplicate = !!duplicate;
  const duplicateWith = duplicate?.id;
  
  const pendingReason = isDuplicate 
    ? `检测到重复授信：与保证函编号 ${data.guaranteeNo} 记录ID#${duplicateWith} 重复，请复核`
    : data.pendingReason;
  
  const status = isDuplicate ? 'disputed' as RecordStatus : (data.status || 'pending');
  
  const info = db.prepare(`
    INSERT INTO guarantee_records (
      guaranteeNo, customerName, amount, currency, source, sourceRef, status,
      pendingReason, reviewReason, currentOperator, createdBy, createdAt, updatedAt,
      version, isDuplicate, duplicateWith, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.guaranteeNo, data.customerName, data.amount, data.currency || 'CNY',
    data.source, data.sourceRef, status, pendingReason, data.reviewReason,
    data.currentOperator || operator, data.createdBy || operator,
    now, now, 1, isDuplicate ? 1 : 0, duplicateWith, data.remark
  );
  
  const record = db.prepare('SELECT * FROM guarantee_records WHERE id = ?').get(info.lastInsertRowid) as GuaranteeRecord;
  const transformedRecord = { ...record, isDuplicate: !!record.isDuplicate } as GuaranteeRecord;
  
  logOperation(
    record.id,
    isDuplicate ? '创建（疑似重复）' : '创建',
    operator,
    { record: { old: null, new: transformedRecord } },
    isDuplicate ? '系统检测到重复授信，自动标记待复核' : undefined,
    undefined,
    status
  );
  
  return { record: transformedRecord, isDuplicate, duplicateWith };
}

export function updateRecord(
  id: number,
  updates: Partial<GuaranteeRecord>,
  operator: string,
  reason?: string
): GuaranteeRecord | null {
  const existing = db.prepare('SELECT * FROM guarantee_records WHERE id = ?').get(id) as GuaranteeRecord;
  if (!existing) return null;
  
  const changes: Record<string, { old: any; new: any }> = {};
  const allowedFields = ['guaranteeNo', 'customerName', 'amount', 'currency', 'source', 'sourceRef', 'status', 'pendingReason', 'reviewReason', 'currentOperator', 'remark'];
  
  const updateData: Record<string, any> = {};
  
  for (const field of allowedFields) {
    if (field in updates && (updates as any)[field] !== (existing as any)[field]) {
      changes[field] = { old: (existing as any)[field], new: (updates as any)[field] };
      updateData[field] = (updates as any)[field];
    }
  }
  
  if (Object.keys(changes).length === 0) return existing;
  
  updateData.updatedAt = new Date().toISOString();
  updateData.version = existing.version + 1;
  
  const setClause = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
  const values = Object.values(updateData);
  values.push(id);
  
  db.prepare(`UPDATE guarantee_records SET ${setClause} WHERE id = ?`).run(...values);
  
  const oldStatus = existing.status;
  const newStatus = updates.status || existing.status;
  
  logOperation(
    id,
    oldStatus !== newStatus ? `状态变更：${getStatusLabel(oldStatus)} → ${getStatusLabel(newStatus)}` : '更新',
    operator,
    changes,
    reason,
    oldStatus,
    newStatus
  );
  
  const record = db.prepare('SELECT * FROM guarantee_records WHERE id = ?').get(id) as GuaranteeRecord;
  return { ...record, isDuplicate: !!record.isDuplicate } as GuaranteeRecord;
}

export function withdrawRecord(id: number, operator: string, reason: string): GuaranteeRecord | null {
  return updateRecord(id, { status: 'withdrawn' } as Partial<GuaranteeRecord>, operator, reason);
}

export function approveRecord(id: number, operator: string, reason?: string): GuaranteeRecord | null {
  return updateRecord(id, { status: 'approved', reviewReason: reason } as Partial<GuaranteeRecord>, operator, reason);
}

export function rejectRecord(id: number, operator: string, reason: string): GuaranteeRecord | null {
  return updateRecord(id, { status: 'rejected', reviewReason: reason } as Partial<GuaranteeRecord>, operator, reason);
}

export function resolveDispute(id: number, operator: string, isDuplicate: boolean, mergeWithId?: number, reason?: string): GuaranteeRecord | null {
  const existing = db.prepare('SELECT * FROM guarantee_records WHERE id = ?').get(id) as GuaranteeRecord;
  if (!existing) return null;
  
  if (isDuplicate && mergeWithId) {
    db.prepare('UPDATE guarantee_records SET isDuplicate = 1, duplicateWith = ?, status = ? WHERE id = ?')
      .run(mergeWithId, 'withdrawn', id);
    
    logOperation(
      id,
      '确认为重复并撤回',
      operator,
      {
        isDuplicate: { old: existing.isDuplicate, new: 1 },
        duplicateWith: { old: existing.duplicateWith, new: mergeWithId },
        status: { old: existing.status, new: 'withdrawn' }
      },
      reason || '确认为重复授信记录',
      existing.status,
      'withdrawn'
    );
    
    const record1 = db.prepare('SELECT * FROM guarantee_records WHERE id = ?').get(id) as GuaranteeRecord;
    return { ...record1, isDuplicate: !!record1.isDuplicate } as GuaranteeRecord;
  } else {
    db.prepare('UPDATE guarantee_records SET isDuplicate = 0, duplicateWith = NULL, status = ? WHERE id = ?')
      .run('pending', id);
    
    logOperation(
      id,
      '排除重复，继续处理',
      operator,
      {
        isDuplicate: { old: existing.isDuplicate, new: 0 },
        duplicateWith: { old: existing.duplicateWith, new: null },
        status: { old: existing.status, new: 'pending' }
      },
      reason || '经复核不属于重复授信',
      existing.status,
      'pending'
    );
    
    const record2 = db.prepare('SELECT * FROM guarantee_records WHERE id = ?').get(id) as GuaranteeRecord;
    return { ...record2, isDuplicate: !!record2.isDuplicate } as GuaranteeRecord;
  }
}

export function getRecordById(id: number): GuaranteeRecord | null {
  const record = db.prepare('SELECT * FROM guarantee_records WHERE id = ?').get(id) as GuaranteeRecord;
  if (!record) return null;
  return { ...record, isDuplicate: !!record.isDuplicate } as GuaranteeRecord;
}

export function getOperationLogs(recordId: number): OperationLog[] {
  return db.prepare(`
    SELECT * FROM operation_logs 
    WHERE recordId = ? 
    ORDER BY createdAt DESC
  `).all(recordId) as OperationLog[];
}

export interface QueryFilters {
  status?: RecordStatus;
  source?: RecordSource;
  isDuplicate?: boolean;
  customerName?: string;
  guaranteeNo?: string;
  startDate?: string;
  endDate?: string;
  currentOperator?: string;
}

export function queryRecords(filters: QueryFilters = {}, page: number = 1, pageSize: number = 50): { records: GuaranteeRecord[]; total: number } {
  const where: string[] = [];
  const params: any[] = [];
  
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.source) {
    where.push('source = ?');
    params.push(filters.source);
  }
  if (filters.isDuplicate !== undefined) {
    where.push('isDuplicate = ?');
    params.push(filters.isDuplicate ? 1 : 0);
  }
  if (filters.customerName) {
    where.push('customerName LIKE ?');
    params.push(`%${filters.customerName}%`);
  }
  if (filters.guaranteeNo) {
    where.push('guaranteeNo LIKE ?');
    params.push(`%${filters.guaranteeNo}%`);
  }
  if (filters.startDate) {
    where.push('createdAt >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    where.push('createdAt <= ?');
    params.push(filters.endDate);
  }
  if (filters.currentOperator) {
    where.push('currentOperator = ?');
    params.push(filters.currentOperator);
  }
  
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  
  const total = db.prepare(`SELECT COUNT(*) as count FROM guarantee_records ${whereClause}`).get(...params) as { count: number };
  
  const offset = (page - 1) * pageSize;
  const records = db.prepare(`
    SELECT * FROM guarantee_records ${whereClause}
    ORDER BY createdAt DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as GuaranteeRecord[];
  
  const transformedRecords = records.map(r => ({
    ...r,
    isDuplicate: !!r.isDuplicate
  })) as GuaranteeRecord[];
  
  return { records: transformedRecords, total: total.count };
}

export function batchImport(records: Array<Omit<GuaranteeRecord, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDuplicate' | 'duplicateWith'>>, operator: string): ImportResult {
  const result: ImportResult = {
    success: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: [],
    importedIds: [],
    duplicateIds: []
  };
  
  for (let i = 0; i < records.length; i++) {
    try {
      const record = records[i];
      if (!record.guaranteeNo || !record.customerName || !record.amount) {
        result.errors++;
        result.errorDetails.push(`第${i + 1}行：缺少必要字段（保证函编号、客户名称、金额）`);
        continue;
      }
      
      const { record: created, isDuplicate, duplicateWith } = createRecord(record, operator);
      
      if (isDuplicate) {
        result.duplicates++;
        result.duplicateIds.push(created.id);
      } else {
        result.success++;
      }
      result.importedIds.push(created.id);
    } catch (e: any) {
      result.errors++;
      result.errorDetails.push(`第${i + 1}行：${e.message}`);
    }
  }
  
  return result;
}
