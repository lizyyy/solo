import { v4 as uuidv4 } from 'uuid';
import { runQuery, getQuery, allQuery } from '../database';
import { ConflictRecord } from '../models/types';
import { createOperationLog } from './operationLog.service';

export async function createConflictRecord(conflictData: {
  slot_id: string;
  patient_id: string;
  patient_name: string;
  conflict_type: 'overlock' | 'dup_patient' | 'system_mismatch' | 'data_error';
  description?: string;
}): Promise<ConflictRecord> {
  const id = uuidv4();
  
  await runQuery(
    `INSERT INTO conflict_records (
      id, slot_id, patient_id, patient_name, conflict_type, description, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      conflictData.slot_id,
      conflictData.patient_id,
      conflictData.patient_name,
      conflictData.conflict_type,
      conflictData.description || ''
    ]
  );
  
  const conflict = await getQuery('SELECT * FROM conflict_records WHERE id = ?', [id]);
  
  await createOperationLog({
    operation_type: 'create_conflict',
    entity_type: 'conflict',
    entity_id: id,
    after_state: conflict,
    result: 'success'
  });
  
  return conflict;
}

export async function resolveConflict(conflictId: string, resolveData: {
  status: 'resolved' | 'ignored';
  resolver_id: string;
  resolver_name: string;
  resolution_note?: string;
}) {
  const conflict = await getConflictById(conflictId);
  if (!conflict) throw new Error('冲突记录不存在');
  if (conflict.status !== 'pending') throw new Error('该冲突已处理');
  
  const beforeState = { ...conflict };
  
  await runQuery(
    'UPDATE conflict_records SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolver_id = ? WHERE id = ?',
    [resolveData.status, resolveData.resolver_id, conflictId]
  );
  
  const updatedConflict = await getConflictById(conflictId);
  
  await createOperationLog({
    operation_type: 'resolve_conflict',
    entity_type: 'conflict',
    entity_id: conflictId,
    operator_id: resolveData.resolver_id,
    operator_name: resolveData.resolver_name,
    before_state: beforeState,
    after_state: updatedConflict,
    result: 'success'
  });
  
  return updatedConflict;
}

export async function getConflictById(id: string): Promise<ConflictRecord | null> {
  return getQuery('SELECT * FROM conflict_records WHERE id = ?', [id]);
}

export async function getConflicts(params: {
  slot_id?: string;
  patient_id?: string;
  status?: string;
  conflict_type?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;
  const offset = (page - 1) * pageSize;
  
  let whereConditions: string[] = [];
  let queryParams: any[] = [];
  
  if (params.slot_id) {
    whereConditions.push('slot_id = ?');
    queryParams.push(params.slot_id);
  }
  if (params.patient_id) {
    whereConditions.push('patient_id = ?');
    queryParams.push(params.patient_id);
  }
  if (params.status) {
    whereConditions.push('status = ?');
    queryParams.push(params.status);
  }
  if (params.conflict_type) {
    whereConditions.push('conflict_type = ?');
    queryParams.push(params.conflict_type);
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  const countResult = await getQuery(
    `SELECT COUNT(*) as total FROM conflict_records ${whereClause}`,
    queryParams
  );
  
  const data = await allQuery(
    `SELECT * FROM conflict_records ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...queryParams, pageSize, offset]
  );
  
  return {
    data,
    total: countResult.total,
    page,
    pageSize
  };
}
