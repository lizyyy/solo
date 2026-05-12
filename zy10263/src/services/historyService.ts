import { v4 as uuidv4 } from 'uuid';
import { runAsync, allAsync } from '../database/connection';
import { OperationHistory } from '../types';

export const recordHistory = async (
  operationType: string,
  entityType: string,
  entityId: string,
  operatorId: string,
  operatorName: string,
  beforeData: any,
  afterData: any,
  remark: string = ''
): Promise<void> => {
  const now = new Date().toISOString();
  await runAsync(
    `INSERT INTO operation_history 
     (id, operation_type, entity_type, entity_id, operator_id, operator_name, before_data, after_data, remark, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      operationType,
      entityType,
      entityId,
      operatorId,
      operatorName,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      remark,
      now
    ]
  );
};

export const getEntityHistory = async (
  entityType: string,
  entityId: string
): Promise<OperationHistory[]> => {
  const rows = await allAsync(
    `SELECT 
      id,
      operation_type as operationType,
      entity_type as entityType,
      entity_id as entityId,
      operator_id as operatorId,
      operator_name as operatorName,
      before_data as beforeData,
      after_data as afterData,
      remark,
      created_at as createdAt
     FROM operation_history
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY created_at DESC`,
    [entityType, entityId]
  );

  return rows.map(row => ({
    ...row,
    beforeData: row.beforeData ? JSON.parse(row.beforeData) : null,
    afterData: row.afterData ? JSON.parse(row.afterData) : null
  }));
};

export const getOperationTypeHistory = async (
  operationType: string,
  limit: number = 50
): Promise<OperationHistory[]> => {
  const rows = await allAsync(
    `SELECT 
      id,
      operation_type as operationType,
      entity_type as entityType,
      entity_id as entityId,
      operator_id as operatorId,
      operator_name as operatorName,
      before_data as beforeData,
      after_data as afterData,
      remark,
      created_at as createdAt
     FROM operation_history
     WHERE operation_type = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [operationType, limit]
  );

  return rows.map(row => ({
    ...row,
    beforeData: row.beforeData ? JSON.parse(row.beforeData) : null,
    afterData: row.afterData ? JSON.parse(row.afterData) : null
  }));
};
