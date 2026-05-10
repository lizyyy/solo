import { v4 as uuidv4 } from 'uuid';
import { runSql, querySql } from '../database/index';
import { OperationLog } from '../models/types';

export async function logOperation(params: {
  operation: string;
  objectId?: string;
  bucketName?: string;
  objectKey?: string;
  requestId: string;
  userId: string;
  status: 'success' | 'failed';
  details: string;
  costEstimate?: number;
}): Promise<string> {
  const logId = uuidv4();
  const timestamp = new Date().toISOString();
  
  await runSql(
    `INSERT INTO operation_logs (
      log_id, operation, object_id, bucket_name, object_key,
      request_id, user_id, timestamp, status, details, cost_estimate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      logId,
      params.operation,
      params.objectId,
      params.bucketName,
      params.objectKey,
      params.requestId,
      params.userId,
      timestamp,
      params.status,
      params.details,
      params.costEstimate
    ]
  );
  
  return logId;
}

export async function getLogsByObject(objectId: string): Promise<OperationLog[]> {
  const rows = await querySql<any>(
    `SELECT * FROM operation_logs WHERE object_id = ? ORDER BY timestamp DESC`,
    [objectId]
  );
  
  return rows.map(row => ({
    logId: row.log_id,
    operation: row.operation,
    objectId: row.object_id,
    bucketName: row.bucket_name,
    objectKey: row.object_key,
    requestId: row.request_id,
    userId: row.user_id,
    timestamp: row.timestamp,
    status: row.status,
    details: row.details,
    costEstimate: row.cost_estimate
  }));
}

export async function getLogsByTimeRange(
  startTime: string,
  endTime: string,
  userId?: string
): Promise<OperationLog[]> {
  let sql = `SELECT * FROM operation_logs WHERE timestamp >= ? AND timestamp <= ?`;
  const params: any[] = [startTime, endTime];
  
  if (userId) {
    sql += ` AND user_id = ?`;
    params.push(userId);
  }
  
  sql += ` ORDER BY timestamp DESC`;
  
  const rows = await querySql<any>(sql, params);
  
  return rows.map(row => ({
    logId: row.log_id,
    operation: row.operation,
    objectId: row.object_id,
    bucketName: row.bucket_name,
    objectKey: row.object_key,
    requestId: row.request_id,
    userId: row.user_id,
    timestamp: row.timestamp,
    status: row.status,
    details: row.details,
    costEstimate: row.cost_estimate
  }));
}

export async function getFailedOperations(
  limit: number = 100
): Promise<OperationLog[]> {
  const rows = await querySql<any>(
    `SELECT * FROM operation_logs WHERE status = 'failed' ORDER BY timestamp DESC LIMIT ?`,
    [limit]
  );
  
  return rows.map(row => ({
    logId: row.log_id,
    operation: row.operation,
    objectId: row.object_id,
    bucketName: row.bucket_name,
    objectKey: row.object_key,
    requestId: row.request_id,
    userId: row.user_id,
    timestamp: row.timestamp,
    status: row.status,
    details: row.details,
    costEstimate: row.cost_estimate
  }));
}
