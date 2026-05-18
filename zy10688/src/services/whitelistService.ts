import { randomUUID } from 'crypto';
import { runQuery, runGet, runInsert } from '../db';
import {
  WhitelistStatus,
  OperationType,
  WhitelistRecord,
  WhitelistHistory,
  ImportResult
} from '../types';
import { cacheWhitelistAccount, removeCachedWhitelist } from './cacheService';

const transformRecord = (row: any): WhitelistRecord => ({
  id: row.id,
  account: row.account,
  reason: row.reason,
  validFrom: row.valid_from,
  validTo: row.valid_to,
  auditor: row.auditor,
  status: row.status as WhitelistStatus,
  remark: row.remark,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by
});

const transformHistory = (row: any): WhitelistHistory => ({
  id: row.id,
  recordId: row.record_id,
  operationType: row.operation_type as OperationType,
  oldStatus: row.old_status as WhitelistStatus,
  newStatus: row.new_status as WhitelistStatus,
  oldData: row.old_data,
  newData: row.new_data,
  remark: row.remark,
  operator: row.operator,
  operatedAt: row.operated_at
});

export const getRecordById = async (id: string): Promise<WhitelistRecord | undefined> => {
  const row = await runGet(
    'SELECT * FROM whitelist_records WHERE id = ?',
    [id]
  );
  return row ? transformRecord(row) : undefined;
};

export const getRecordByAccount = async (account: string): Promise<WhitelistRecord | undefined> => {
  const row = await runGet(
    'SELECT * FROM whitelist_records WHERE account = ? ORDER BY created_at DESC LIMIT 1',
    [account]
  );
  return row ? transformRecord(row) : undefined;
};

export const listRecords = async (filters?: {
  status?: WhitelistStatus;
  account?: string;
  auditor?: string;
}): Promise<WhitelistRecord[]> => {
  let sql = 'SELECT * FROM whitelist_records WHERE 1=1';
  const params: any[] = [];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters?.account) {
    sql += ' AND account LIKE ?';
    params.push(`%${filters.account}%`);
  }
  if (filters?.auditor) {
    sql += ' AND auditor LIKE ?';
    params.push(`%${filters.auditor}%`);
  }
  sql += ' ORDER BY created_at DESC';

  const rows = await runQuery(sql, params);
  return rows.map(transformRecord);
};

const recordHistory = async (
  recordId: string,
  operationType: OperationType,
  operator: string,
  options?: {
    oldStatus?: WhitelistStatus;
    newStatus?: WhitelistStatus;
    oldData?: any;
    newData?: any;
    remark?: string;
  }
): Promise<void> => {
  const id = randomUUID();
  await runInsert(
    `INSERT INTO whitelist_history 
     (id, record_id, operation_type, old_status, new_status, old_data, new_data, remark, operator, operated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      recordId,
      operationType,
      options?.oldStatus,
      options?.newStatus,
      options?.oldData ? JSON.stringify(options.oldData) : null,
      options?.newData ? JSON.stringify(options.newData) : null,
      options?.remark,
      operator,
      new Date().toISOString()
    ]
  );
};

export const createRecord = async (data: {
  account: string;
  reason: string;
  validFrom: string;
  validTo: string;
  auditor: string;
  createdBy: string;
  remark?: string;
}): Promise<WhitelistRecord> => {
  const existing = await getRecordByAccount(data.account);
  if (existing && existing.status !== WhitelistStatus.EXPIRED) {
    throw new Error(`账号 ${data.account} 已存在有效白名单记录`);
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await runInsert(
    `INSERT INTO whitelist_records 
     (id, account, reason, valid_from, valid_to, auditor, status, remark, created_at, updated_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.account,
      data.reason,
      data.validFrom,
      data.validTo,
      data.auditor,
      WhitelistStatus.ACTIVE,
      data.remark,
      now,
      now,
      data.createdBy
    ]
  );

  const record = await getRecordById(id);
  if (!record) throw new Error('创建记录失败');

  await recordHistory(id, OperationType.CREATE, data.createdBy, {
    newStatus: WhitelistStatus.ACTIVE,
    newData: record
  });

  cacheWhitelistAccount(data.account, WhitelistStatus.ACTIVE);
  return record;
};

export const importRecords = async (
  records: Array<{
    account: string;
    reason: string;
    validFrom: string;
    validTo: string;
    auditor: string;
    createdBy: string;
    status?: WhitelistStatus;
    remark?: string;
  }>
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      if (!record.account || !record.reason || !record.validFrom || !record.validTo || !record.auditor) {
        throw new Error('必填字段缺失');
      }

      const validFrom = new Date(record.validFrom);
      const validTo = new Date(record.validTo);
      if (isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
        throw new Error('日期格式无效');
      }
      if (validTo <= validFrom) {
        throw new Error('有效期结束时间必须晚于开始时间');
      }

      const existing = await getRecordByAccount(record.account);
      if (existing && existing.status === WhitelistStatus.ACTIVE) {
        throw new Error('账号已有生效中记录');
      }

      const id = randomUUID();
      const now = new Date().toISOString();
      const status = record.status || WhitelistStatus.ACTIVE;

      await runInsert(
        `INSERT INTO whitelist_records 
         (id, account, reason, valid_from, valid_to, auditor, status, remark, created_at, updated_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          record.account,
          record.reason,
          record.validFrom,
          record.validTo,
          record.auditor,
          status,
          record.remark,
          now,
          now,
          record.createdBy
        ]
      );

      await recordHistory(id, OperationType.IMPORT, record.createdBy, {
        newStatus: status,
        newData: { ...record, id, status }
      });

      if (status === WhitelistStatus.ACTIVE) {
        cacheWhitelistAccount(record.account, status);
      }

      result.success++;
    } catch (error: any) {
      result.failed++;
      result.errors.push({
        row: i + 1,
        account: record.account || '未知',
        reason: error.message
      });
    }
  }

  return result;
};

export const submitExpire = async (id: string, operator: string, remark?: string): Promise<WhitelistRecord> => {
  const record = await getRecordById(id);
  if (!record) throw new Error('记录不存在');
  if (record.status !== WhitelistStatus.ACTIVE) {
    throw new Error('只有生效中的记录可以提交失效');
  }

  const now = new Date().toISOString();
  await runInsert(
    `UPDATE whitelist_records SET status = ?, remark = ?, updated_at = ? WHERE id = ?`,
    [WhitelistStatus.PENDING_EXPIRE, remark || record.remark, now, id]
  );

  await recordHistory(id, OperationType.SUBMIT_EXPIRE, operator, {
    oldStatus: WhitelistStatus.ACTIVE,
    newStatus: WhitelistStatus.PENDING_EXPIRE,
    oldData: record,
    remark
  });

  const updated = await getRecordById(id);
  if (!updated) throw new Error('更新记录失败');
  return updated;
};

export const approveExpire = async (id: string, operator: string, remark?: string): Promise<WhitelistRecord> => {
  const record = await getRecordById(id);
  if (!record) throw new Error('记录不存在');
  if (record.status !== WhitelistStatus.PENDING_EXPIRE) {
    throw new Error('只有失效待审的记录可以审核');
  }

  const now = new Date().toISOString();
  await runInsert(
    `UPDATE whitelist_records SET status = ?, remark = ?, updated_at = ? WHERE id = ?`,
    [WhitelistStatus.EXPIRED, remark || record.remark, now, id]
  );

  await recordHistory(id, OperationType.APPROVE_EXPIRE, operator, {
    oldStatus: WhitelistStatus.PENDING_EXPIRE,
    newStatus: WhitelistStatus.EXPIRED,
    oldData: record,
    remark
  });

  cacheWhitelistAccount(record.account, WhitelistStatus.EXPIRED);
  const updated = await getRecordById(id);
  if (!updated) throw new Error('更新记录失败');
  return updated;
};

export const withdraw = async (id: string, operator: string, remark?: string): Promise<WhitelistRecord> => {
  const record = await getRecordById(id);
  if (!record) throw new Error('记录不存在');
  if (record.status !== WhitelistStatus.PENDING_EXPIRE && record.status !== WhitelistStatus.RESTORE_REQUESTED) {
    throw new Error('只有待审状态的记录可以撤回');
  }

  const targetStatus = record.status === WhitelistStatus.PENDING_EXPIRE 
    ? WhitelistStatus.ACTIVE 
    : WhitelistStatus.EXPIRED;

  const now = new Date().toISOString();
  await runInsert(
    `UPDATE whitelist_records SET status = ?, remark = ?, updated_at = ? WHERE id = ?`,
    [targetStatus, remark || record.remark, now, id]
  );

  await recordHistory(id, OperationType.WITHDRAW, operator, {
    oldStatus: record.status,
    newStatus: targetStatus,
    oldData: record,
    remark
  });

  if (targetStatus === WhitelistStatus.ACTIVE) {
    cacheWhitelistAccount(record.account, WhitelistStatus.ACTIVE);
  }

  const updated = await getRecordById(id);
  if (!updated) throw new Error('更新记录失败');
  return updated;
};

export const requestRestore = async (id: string, operator: string, remark?: string): Promise<WhitelistRecord> => {
  const record = await getRecordById(id);
  if (!record) throw new Error('记录不存在');
  if (record.status !== WhitelistStatus.EXPIRED) {
    throw new Error('只有已失效的记录可以申请恢复');
  }

  const now = new Date().toISOString();
  await runInsert(
    `UPDATE whitelist_records SET status = ?, remark = ?, updated_at = ? WHERE id = ?`,
    [WhitelistStatus.RESTORE_REQUESTED, remark || record.remark, now, id]
  );

  await recordHistory(id, OperationType.RESTORE_REQUEST, operator, {
    oldStatus: WhitelistStatus.EXPIRED,
    newStatus: WhitelistStatus.RESTORE_REQUESTED,
    oldData: record,
    remark
  });

  const updated = await getRecordById(id);
  if (!updated) throw new Error('更新记录失败');
  return updated;
};

export const approveRestore = async (id: string, operator: string, remark?: string): Promise<WhitelistRecord> => {
  const record = await getRecordById(id);
  if (!record) throw new Error('记录不存在');
  if (record.status !== WhitelistStatus.RESTORE_REQUESTED) {
    throw new Error('只有恢复申请中的记录可以审核');
  }

  const now = new Date().toISOString();
  await runInsert(
    `UPDATE whitelist_records SET status = ?, remark = ?, updated_at = ? WHERE id = ?`,
    [WhitelistStatus.ACTIVE, remark || record.remark, now, id]
  );

  await recordHistory(id, OperationType.APPROVE_RESTORE, operator, {
    oldStatus: WhitelistStatus.RESTORE_REQUESTED,
    newStatus: WhitelistStatus.ACTIVE,
    oldData: record,
    remark
  });

  cacheWhitelistAccount(record.account, WhitelistStatus.ACTIVE);
  const updated = await getRecordById(id);
  if (!updated) throw new Error('更新记录失败');
  return updated;
};

export const addRemark = async (id: string, operator: string, remark: string): Promise<WhitelistRecord> => {
  const record = await getRecordById(id);
  if (!record) throw new Error('记录不存在');

  const now = new Date().toISOString();
  const newRemark = record.remark ? `${record.remark}\n${remark}` : remark;

  await runInsert(
    `UPDATE whitelist_records SET remark = ?, updated_at = ? WHERE id = ?`,
    [newRemark, now, id]
  );

  await recordHistory(id, OperationType.REMARK, operator, {
    oldData: record,
    remark
  });

  const updated = await getRecordById(id);
  if (!updated) throw new Error('更新记录失败');
  return updated;
};

export const getHistory = async (recordId: string): Promise<WhitelistHistory[]> => {
  const rows = await runQuery(
    'SELECT * FROM whitelist_history WHERE record_id = ? ORDER BY operated_at DESC',
    [recordId]
  );
  return rows.map(transformHistory);
};

export const exportRecords = async (filters?: {
  status?: WhitelistStatus;
  account?: string;
}): Promise<WhitelistRecord[]> => {
  return listRecords(filters);
};
