import { getDb, generateId, now, saveDatabase, executeGet, executeAll } from '../database';
import { IdempotentRequest, OperationLog } from '../types';

const IDEMPOTENT_TTL_MS = 24 * 60 * 60 * 1000;

export const checkIdempotent = (requestKey: string): IdempotentRequest | null => {
  if (!requestKey) return null;
  
  const existing = executeGet<IdempotentRequest>(
    'SELECT * FROM idempotent_requests WHERE request_key = ? AND expires_at > ?',
    [requestKey, now()]
  );

  return existing;
};

export const saveIdempotentResponse = (
  requestKey: string,
  requestType: string,
  responseData: string
): IdempotentRequest => {
  const db = getDb();
  const existing = checkIdempotent(requestKey);
  
  if (existing) {
    return existing;
  }

  const request: IdempotentRequest = {
    id: generateId(),
    request_key: requestKey,
    request_type: requestType,
    response_data: responseData,
    created_at: now(),
    expires_at: now() + IDEMPOTENT_TTL_MS,
  };

  db.run(`
    INSERT INTO idempotent_requests (
      id, request_key, request_type, response_data, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
    request.id,
    request.request_key,
    request.request_type,
    request.response_data,
    request.created_at,
    request.expires_at,
  ]);

  saveDatabase();
  return request;
};

export const logOperation = (
  orderId: string,
  operatorId: string,
  operatorRole: string,
  operationType: string,
  operationDetail?: string,
  oldData?: object | null,
  newData?: object
): OperationLog => {
  const db = getDb();

  const log: OperationLog = {
    id: generateId(),
    order_id: orderId,
    operator_id: operatorId,
    operator_role: operatorRole,
    operation_type: operationType,
    operation_detail: operationDetail || null,
    old_data: oldData ? JSON.stringify(oldData) : null,
    new_data: newData ? JSON.stringify(newData) : null,
    created_at: now(),
  };

  db.run(`
    INSERT INTO operation_logs (
      id, order_id, operator_id, operator_role, operation_type,
      operation_detail, old_data, new_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    log.id,
    log.order_id,
    log.operator_id,
    log.operator_role,
    log.operation_type,
    log.operation_detail,
    log.old_data,
    log.new_data,
    log.created_at,
  ]);

  return log;
};

export const getOperationLogs = (orderId: string, limit: number = 50): OperationLog[] => {
  return executeAll<OperationLog>(
    `SELECT * FROM operation_logs WHERE order_id = ? ORDER BY created_at DESC LIMIT ?`,
    [orderId, limit]
  );
};

export const cleanupExpiredIdempotent = (): number => {
  const db = getDb();
  const before = now();
  db.run('DELETE FROM idempotent_requests WHERE expires_at < ?', [before]);
  const changes = db.getRowsModified();
  if (changes > 0) {
    saveDatabase();
  }
  return changes;
};
