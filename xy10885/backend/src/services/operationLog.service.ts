import { v4 as uuidv4 } from 'uuid';
import { runQuery } from '../database';

export async function createOperationLog(log: {
  operation_type: string;
  entity_type: string;
  entity_id: string;
  operator_id?: string;
  operator_name?: string;
  before_state?: any;
  after_state?: any;
  result: 'success' | 'failed';
  error_message?: string;
}) {
  const id = uuidv4();
  await runQuery(
    `INSERT INTO operation_logs (
      id, operation_type, entity_type, entity_id, operator_id, operator_name,
      before_state, after_state, result, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      log.operation_type,
      log.entity_type,
      log.entity_id,
      log.operator_id,
      log.operator_name,
      log.before_state ? JSON.stringify(log.before_state) : null,
      log.after_state ? JSON.stringify(log.after_state) : null,
      log.result,
      log.error_message
    ]
  );
  return id;
}

export async function getOperationLogs(entityType?: string, entityId?: string, limit: number = 100) {
  let sql = 'SELECT * FROM operation_logs';
  const params: any[] = [];
  
  if (entityType && entityId) {
    sql += ' WHERE entity_type = ? AND entity_id = ?';
    params.push(entityType, entityId);
  } else if (entityType) {
    sql += ' WHERE entity_type = ?';
    params.push(entityType);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  const { allQuery } = await import('../database');
  return allQuery(sql, params);
}
