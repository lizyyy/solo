import { v4 as uuidv4 } from 'uuid';
import sqlite3 from 'sqlite3';
import {
  OrganizationAdjustment,
  AdjustmentHistory,
  AdjustmentStatus,
  OperationSource,
  CreateAdjustmentRequest,
  UpdateStatusRequest
} from '../types';
import { getDatabase, runAsync, getAsync, allAsync } from '../database';
import {
  ValidationError,
  DuplicateRequestError,
  InvalidStatusTransitionError,
  AdjustmentNotFoundError,
  ConflictAdjustmentError,
  ImportError
} from '../errors';

const STATUS_TRANSITIONS: Record<AdjustmentStatus, AdjustmentStatus[]> = {
  [AdjustmentStatus.PENDING_RECALCULATION]: [
    AdjustmentStatus.RECALCULATING,
    AdjustmentStatus.PENDING_REVIEW
  ],
  [AdjustmentStatus.RECALCULATING]: [
    AdjustmentStatus.EFFECTIVE,
    AdjustmentStatus.PENDING_REVIEW,
    AdjustmentStatus.PENDING_RECALCULATION
  ],
  [AdjustmentStatus.EFFECTIVE]: [],
  [AdjustmentStatus.PENDING_REVIEW]: [
    AdjustmentStatus.PENDING_RECALCULATION,
    AdjustmentStatus.RECALCULATING
  ]
};

function rowToAdjustment(row: any): OrganizationAdjustment {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    oldDepartmentId: row.old_department_id,
    oldDepartmentName: row.old_department_name,
    newDepartmentId: row.new_department_id,
    newDepartmentName: row.new_department_name,
    dataScope: row.data_scope,
    retainOldDataAccess: Boolean(row.retain_old_data_access),
    status: row.status as AdjustmentStatus,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    operationSource: row.operation_source as OperationSource,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    effectiveAt: row.effective_at ? new Date(row.effective_at) : undefined,
    remark: row.remark
  };
}

function rowToHistory(row: any): AdjustmentHistory {
  return {
    id: row.id,
    adjustmentId: row.adjustment_id,
    fromStatus: row.from_status as AdjustmentStatus | undefined,
    toStatus: row.to_status as AdjustmentStatus,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    operationSource: row.operation_source as OperationSource,
    operationType: row.operation_type,
    remark: row.remark,
    createdAt: new Date(row.created_at)
  };
}

function validateCreateRequest(req: CreateAdjustmentRequest): void {
  const errors: string[] = [];
  
  if (!req.userId?.trim()) errors.push('用户ID不能为空');
  if (!req.userName?.trim()) errors.push('用户姓名不能为空');
  if (!req.oldDepartmentId?.trim()) errors.push('原部门ID不能为空');
  if (!req.oldDepartmentName?.trim()) errors.push('原部门名称不能为空');
  if (!req.newDepartmentId?.trim()) errors.push('新部门ID不能为空');
  if (!req.newDepartmentName?.trim()) errors.push('新部门名称不能为空');
  if (!req.dataScope?.trim()) errors.push('数据范围不能为空');
  if (!req.operatorId?.trim()) errors.push('操作者ID不能为空');
  if (!req.operatorName?.trim()) errors.push('操作者姓名不能为空');
  
  if (errors.length > 0) {
    throw new ValidationError('请求参数验证失败', errors);
  }
  
  if (req.oldDepartmentId === req.newDepartmentId) {
    throw new ValidationError('原部门和新部门不能相同');
  }
}

async function checkConflictingAdjustments(
  db: sqlite3.Database,
  userId: string,
  excludeId?: string
): Promise<string[]> {
  const activeStatuses = [
    AdjustmentStatus.PENDING_RECALCULATION,
    AdjustmentStatus.RECALCULATING,
    AdjustmentStatus.PENDING_REVIEW
  ].map(s => `'${s}'`).join(',');
  
  let sql = `
    SELECT id FROM organization_adjustments
    WHERE user_id = ? AND status IN (${activeStatuses})
  `;
  const params: any[] = [userId];
  
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  
  const rows = await allAsync(db, sql, params);
  return rows.map(r => r.id);
}

async function createHistoryRecord(
  db: sqlite3.Database,
  adjustmentId: string,
  fromStatus: AdjustmentStatus | undefined,
  toStatus: AdjustmentStatus,
  operatorId: string,
  operatorName: string,
  operationSource: OperationSource,
  operationType: string,
  remark?: string
): Promise<void> {
  const historyId = uuidv4();
  const now = new Date().toISOString();
  
  await runAsync(db, `
    INSERT INTO adjustment_histories (
      id, adjustment_id, from_status, to_status,
      operator_id, operator_name, operation_source,
      operation_type, remark, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    historyId, adjustmentId, fromStatus, toStatus,
    operatorId, operatorName, operationSource,
    operationType, remark, now
  ]);
}

export async function createAdjustment(
  req: CreateAdjustmentRequest
): Promise<OrganizationAdjustment> {
  validateCreateRequest(req);
  
  const db = await getDatabase();
  const adjustmentId = uuidv4();
  const now = new Date();
  const status = AdjustmentStatus.PENDING_RECALCULATION;
  
  const conflictIds = await checkConflictingAdjustments(db, req.userId);
  if (conflictIds.length > 0) {
    throw new ConflictAdjustmentError(req.userId, conflictIds);
  }
  
  await runAsync(db, `
    INSERT INTO organization_adjustments (
      id, user_id, user_name, old_department_id, old_department_name,
      new_department_id, new_department_name, data_scope,
      retain_old_data_access, status, operator_id, operator_name,
      operation_source, created_at, updated_at, remark
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    adjustmentId, req.userId, req.userName,
    req.oldDepartmentId, req.oldDepartmentName,
    req.newDepartmentId, req.newDepartmentName,
    req.dataScope, req.retainOldDataAccess ? 1 : 0,
    status, req.operatorId, req.operatorName,
    req.operationSource, now.toISOString(), now.toISOString(),
    req.remark
  ]);
  
  await createHistoryRecord(
    db, adjustmentId, undefined, status,
    req.operatorId, req.operatorName, req.operationSource,
    'CREATE', req.remark
  );
  
  const row = await getAsync(db, 'SELECT * FROM organization_adjustments WHERE id = ?', [adjustmentId]);
  if (!row) throw new AdjustmentNotFoundError(adjustmentId);
  
  return rowToAdjustment(row);
}

export async function updateAdjustmentStatus(
  id: string,
  req: UpdateStatusRequest
): Promise<OrganizationAdjustment> {
  const db = await getDatabase();
  
  const row = await getAsync(db, 'SELECT * FROM organization_adjustments WHERE id = ?', [id]);
  if (!row) throw new AdjustmentNotFoundError(id);
  
  const currentStatus = row.status as AdjustmentStatus;
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  
  if (!allowedTransitions.includes(req.status)) {
    throw new InvalidStatusTransitionError(currentStatus, req.status);
  }
  
  const now = new Date();
  const updateParams: any[] = [req.status, now.toISOString(), id];
  
  let effectiveAtSql = '';
  if (req.status === AdjustmentStatus.EFFECTIVE) {
    effectiveAtSql = ', effective_at = ?';
    updateParams.splice(2, 0, now.toISOString());
  }
  
  await runAsync(db, `
    UPDATE organization_adjustments
    SET status = ?, updated_at = ?${effectiveAtSql}
    WHERE id = ?
  `, updateParams);
  
  await createHistoryRecord(
    db, id, currentStatus, req.status,
    req.operatorId, req.operatorName, req.operationSource,
    'STATUS_CHANGE', req.remark
  );
  
  const updatedRow = await getAsync(db, 'SELECT * FROM organization_adjustments WHERE id = ?', [id]);
  if (!updatedRow) throw new AdjustmentNotFoundError(id);
  
  return rowToAdjustment(updatedRow);
}

export async function getAdjustmentById(id: string): Promise<OrganizationAdjustment> {
  const db = await getDatabase();
  const row = await getAsync(db, 'SELECT * FROM organization_adjustments WHERE id = ?', [id]);
  if (!row) throw new AdjustmentNotFoundError(id);
  return rowToAdjustment(row);
}

export async function listAdjustments(params?: {
  userId?: string;
  status?: AdjustmentStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: OrganizationAdjustment[]; total: number }> {
  const db = await getDatabase();
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  let whereClauses: string[] = [];
  let queryParams: any[] = [];
  
  if (params?.userId) {
    whereClauses.push('user_id = ?');
    queryParams.push(params.userId);
  }
  
  if (params?.status) {
    whereClauses.push('status = ?');
    queryParams.push(params.status);
  }
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const countRow = await getAsync(db, `
    SELECT COUNT(*) as total FROM organization_adjustments ${whereSql}
  `, queryParams);
  const total = countRow?.total || 0;
  
  const rows = await allAsync(db, `
    SELECT * FROM organization_adjustments ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [...queryParams, pageSize, offset]);
  
  return {
    items: rows.map(rowToAdjustment),
    total
  };
}

export async function getAdjustmentHistories(adjustmentId: string): Promise<AdjustmentHistory[]> {
  const db = await getDatabase();
  
  const existsRow = await getAsync(
    db,
    'SELECT 1 FROM organization_adjustments WHERE id = ?',
    [adjustmentId]
  );
  if (!existsRow) throw new AdjustmentNotFoundError(adjustmentId);
  
  const rows = await allAsync(db, `
    SELECT * FROM adjustment_histories
    WHERE adjustment_id = ?
    ORDER BY created_at ASC
  `, [adjustmentId]);
  
  return rows.map(rowToHistory);
}

export async function withdrawAdjustment(
  id: string,
  operatorId: string,
  operatorName: string,
  operationSource: OperationSource,
  remark?: string
): Promise<OrganizationAdjustment> {
  const db = await getDatabase();
  
  const row = await getAsync(db, 'SELECT * FROM organization_adjustments WHERE id = ?', [id]);
  if (!row) throw new AdjustmentNotFoundError(id);
  
  const currentStatus = row.status as AdjustmentStatus;
  if (currentStatus === AdjustmentStatus.EFFECTIVE) {
    throw new InvalidStatusTransitionError(currentStatus, 'WITHDRAW');
  }
  
  const now = new Date();
  const newStatus = AdjustmentStatus.PENDING_REVIEW;
  
  await runAsync(db, `
    UPDATE organization_adjustments
    SET status = ?, updated_at = ?
    WHERE id = ?
  `, [newStatus, now.toISOString(), id]);
  
  await createHistoryRecord(
    db, id, currentStatus, newStatus,
    operatorId, operatorName, operationSource,
    'WITHDRAW', remark || '撤回调整'
  );
  
  const updatedRow = await getAsync(db, 'SELECT * FROM organization_adjustments WHERE id = ?', [id]);
  if (!updatedRow) throw new AdjustmentNotFoundError(id);
  
  return rowToAdjustment(updatedRow);
}

export async function importAdjustments(
  data: any[],
  operatorId: string,
  operatorName: string
): Promise<{ success: number; failed: number; errors: Array<{ row: number; error: string; data: any }> }> {
  const db = await getDatabase();
  const results: { success: number; failed: number; errors: any[] } = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  for (let i = 0; i < data.length; i++) {
    const rowData = data[i];
    const rowNumber = i + 1;
    
    try {
      if (!rowData.userId || !rowData.userName) {
        throw new ImportError('缺少必要字段: 用户信息', rowNumber, rowData);
      }
      
      const adjustmentId = uuidv4();
      const now = new Date();
      const status = AdjustmentStatus.PENDING_RECALCULATION;
      
      await runAsync(db, `
        INSERT INTO organization_adjustments (
          id, user_id, user_name, old_department_id, old_department_name,
          new_department_id, new_department_name, data_scope,
          retain_old_data_access, status, operator_id, operator_name,
          operation_source, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        adjustmentId,
        rowData.userId,
        rowData.userName,
        rowData.oldDepartmentId || '',
        rowData.oldDepartmentName || '',
        rowData.newDepartmentId || '',
        rowData.newDepartmentName || '',
        rowData.dataScope || '',
        rowData.retainOldDataAccess ? 1 : 0,
        status,
        operatorId,
        operatorName,
        OperationSource.IMPORT,
        now.toISOString(),
        now.toISOString()
      ]);
      
      await createHistoryRecord(
        db, adjustmentId, undefined, status,
        operatorId, operatorName, OperationSource.IMPORT,
        'IMPORT', `第${rowNumber}行导入`
      );
      
      results.success++;
    } catch (error: any) {
      results.failed++;
      results.errors.push({
        row: rowNumber,
        error: error.message,
        data: rowData
      });
    }
  }
  
  return results;
}

export async function getAllAdjustmentsForExport(): Promise<OrganizationAdjustment[]> {
  const db = await getDatabase();
  const rows = await allAsync(db, `
    SELECT * FROM organization_adjustments
    ORDER BY created_at DESC
  `);
  return rows.map(rowToAdjustment);
}
