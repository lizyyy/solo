import { v4 as uuidv4 } from 'uuid';
import { Operation, CorrectionRecord, OperationStatus, RiskLevel, QueryOperationsFilter, PaginatedResult } from '../types';
import { runQuery, getOne, getAll } from '../database';

interface OperationRow {
  id: string;
  operation_no: string;
  title: string;
  description: string;
  resource_object: string;
  resource_type: string;
  risk_level: string;
  executor_id: string;
  executor_name: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  status: string;
  plan_execute_time: string | null;
  actual_execute_time: string | null;
  complete_time: string | null;
  operation_result: string | null;
  error_message: string | null;
  raw_input: string;
  created_at: string;
  updated_at: string;
}

interface CorrectionRow {
  id: string;
  operation_id: string;
  corrector_id: string;
  corrector_name: string;
  correction_reason: string;
  original_data: string;
  corrected_data: string;
  created_at: string;
}

function mapOperationRow(row: OperationRow): Operation {
  return {
    id: row.id,
    operationNo: row.operation_no,
    title: row.title,
    description: row.description,
    resourceObject: row.resource_object,
    resourceType: row.resource_type,
    riskLevel: row.risk_level as RiskLevel,
    executorId: row.executor_id,
    executorName: row.executor_name,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    status: row.status as OperationStatus,
    planExecuteTime: row.plan_execute_time ? new Date(row.plan_execute_time) : null,
    actualExecuteTime: row.actual_execute_time ? new Date(row.actual_execute_time) : null,
    completeTime: row.complete_time ? new Date(row.complete_time) : null,
    operationResult: row.operation_result,
    errorMessage: row.error_message,
    rawInput: JSON.parse(row.raw_input),
    correctionHistory: [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function mapCorrectionRow(row: CorrectionRow): CorrectionRecord {
  return {
    id: row.id,
    operationId: row.operation_id,
    correctorId: row.corrector_id,
    correctorName: row.corrector_name,
    correctionReason: row.correction_reason,
    originalData: JSON.parse(row.original_data),
    correctedData: JSON.parse(row.corrected_data),
    createdAt: new Date(row.created_at)
  };
}

export async function generateOperationNo(): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `OPS${dateStr}`;
  
  const row = await getOne<{ max_no: string }>(
    'SELECT MAX(operation_no) as max_no FROM operations WHERE operation_no LIKE ?',
    [`${prefix}%`]
  );
  
  let sequence = 1;
  if (row && row.max_no) {
    const match = row.max_no.match(/(\d{4})$/);
    if (match) {
      sequence = parseInt(match[1], 10) + 1;
    }
  }
  
  return `${prefix}${sequence.toString().padStart(4, '0')}`;
}

export async function createOperation(
  data: Omit<Operation, 'id' | 'operationNo' | 'status' | 'reviewerId' | 'reviewerName' | 'actualExecuteTime' | 'completeTime' | 'operationResult' | 'errorMessage' | 'correctionHistory' | 'createdAt' | 'updatedAt'>
): Promise<Operation> {
  const id = uuidv4();
  const operationNo = await generateOperationNo();
  const now = new Date().toISOString();
  
  await runQuery(`
    INSERT INTO operations (
      id, operation_no, title, description, resource_object, resource_type,
      risk_level, executor_id, executor_name, status, plan_execute_time,
      raw_input, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, operationNo, data.title, data.description, data.resourceObject, data.resourceType,
    data.riskLevel, data.executorId, data.executorName, OperationStatus.CREATED,
    data.planExecuteTime?.toISOString() || null,
    JSON.stringify(data.rawInput), now, now
  ]);
  
  return getOperationById(id) as Promise<Operation>;
}

export async function getOperationById(id: string): Promise<Operation | null> {
  const row = await getOne<OperationRow>(
    'SELECT * FROM operations WHERE id = ?',
    [id]
  );
  
  if (!row) return null;
  
  const operation = mapOperationRow(row);
  
  const correctionRows = await getAll<CorrectionRow>(
    'SELECT * FROM correction_records WHERE operation_id = ? ORDER BY created_at DESC',
    [id]
  );
  operation.correctionHistory = correctionRows.map(mapCorrectionRow);
  
  return operation;
}

export async function getOperationByNo(operationNo: string): Promise<Operation | null> {
  const row = await getOne<OperationRow>(
    'SELECT * FROM operations WHERE operation_no = ?',
    [operationNo]
  );
  
  if (!row) return null;
  
  const operation = mapOperationRow(row);
  
  const correctionRows = await getAll<CorrectionRow>(
    'SELECT * FROM correction_records WHERE operation_id = ? ORDER BY created_at DESC',
    [operation.id]
  );
  operation.correctionHistory = correctionRows.map(mapCorrectionRow);
  
  return operation;
}

export async function queryOperations(filter: QueryOperationsFilter): Promise<PaginatedResult<Operation>> {
  const page = filter.page || 1;
  const pageSize = filter.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter.riskLevel) {
    conditions.push('risk_level = ?');
    params.push(filter.riskLevel);
  }
  if (filter.executorId) {
    conditions.push('executor_id = ?');
    params.push(filter.executorId);
  }
  if (filter.reviewerId) {
    conditions.push('reviewer_id = ?');
    params.push(filter.reviewerId);
  }
  if (filter.startDate) {
    conditions.push('created_at >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push('created_at <= ?');
    params.push(filter.endDate);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const countResult = await getOne<{ total: number }>(
    `SELECT COUNT(*) as total FROM operations ${whereClause}`,
    params
  );
  const total = countResult?.total || 0;
  
  const rows = await getAll<OperationRow>(
    `SELECT * FROM operations ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  
  const data = rows.map(mapOperationRow);
  
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

export async function updateOperationStatus(
  id: string,
  status: OperationStatus,
  updates: Partial<{
    reviewerId: string;
    reviewerName: string;
    actualExecuteTime: Date;
    completeTime: Date;
    operationResult: string;
    errorMessage: string;
  }> = {}
): Promise<void> {
  const now = new Date().toISOString();
  const setClauses: string[] = ['status = ?', 'updated_at = ?'];
  const params: any[] = [status, now];
  
  if (updates.reviewerId !== undefined) {
    setClauses.push('reviewer_id = ?');
    params.push(updates.reviewerId);
  }
  if (updates.reviewerName !== undefined) {
    setClauses.push('reviewer_name = ?');
    params.push(updates.reviewerName);
  }
  if (updates.actualExecuteTime !== undefined) {
    setClauses.push('actual_execute_time = ?');
    params.push(updates.actualExecuteTime.toISOString());
  }
  if (updates.completeTime !== undefined) {
    setClauses.push('complete_time = ?');
    params.push(updates.completeTime.toISOString());
  }
  if (updates.operationResult !== undefined) {
    setClauses.push('operation_result = ?');
    params.push(updates.operationResult);
  }
  if (updates.errorMessage !== undefined) {
    setClauses.push('error_message = ?');
    params.push(updates.errorMessage);
  }
  
  params.push(id);
  
  await runQuery(
    `UPDATE operations SET ${setClauses.join(', ')} WHERE id = ?`,
    params
  );
}

export async function createCorrectionRecord(
  data: Omit<CorrectionRecord, 'id' | 'createdAt'>
): Promise<CorrectionRecord> {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  await runQuery(`
    INSERT INTO correction_records (
      id, operation_id, corrector_id, corrector_name,
      correction_reason, original_data, corrected_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id, data.operationId, data.correctorId, data.correctorName,
    data.correctionReason, JSON.stringify(data.originalData),
    JSON.stringify(data.correctedData), now
  ]);
  
  const row = await getOne<CorrectionRow>(
    'SELECT * FROM correction_records WHERE id = ?',
    [id]
  );
  
  return mapCorrectionRow(row!);
}

export async function getAllOperationsForExport(filter: { startDate?: string; endDate?: string } = {}): Promise<Operation[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  
  if (filter.startDate) {
    conditions.push('created_at >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push('created_at <= ?');
    params.push(filter.endDate);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const rows = await getAll<OperationRow>(
    `SELECT * FROM operations ${whereClause} ORDER BY created_at DESC`,
    params
  );
  
  const operations = rows.map(mapOperationRow);
  
  for (const op of operations) {
    const correctionRows = await getAll<CorrectionRow>(
      'SELECT * FROM correction_records WHERE operation_id = ? ORDER BY created_at DESC',
      [op.id]
    );
    op.correctionHistory = correctionRows.map(mapCorrectionRow);
  }
  
  return operations;
}
