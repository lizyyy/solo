import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import db from '../database/init';
import { OperationType, OperationLog } from '../types';

function serializeMetadata(metadata?: Record<string, unknown>): string | undefined {
  if (!metadata) return undefined;
  try {
    return JSON.stringify(metadata);
  } catch {
    return undefined;
  }
}

function deserializeMetadata(metadataStr?: string): Record<string, unknown> | undefined {
  if (!metadataStr) return undefined;
  try {
    return JSON.parse(metadataStr) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export async function logOperation(
  operationType: OperationType,
  entityType: string,
  entityId: string,
  description: string,
  operator: string,
  options?: {
    fromStatus?: string;
    toStatus?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const id = uuidv4();
  const timestamp = moment().toISOString();
  const metadataStr = serializeMetadata(options?.metadata);

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO operation_logs (
        id, operation_type, entity_type, entity_id, from_status, to_status,
        description, operator, timestamp, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        operationType,
        entityType,
        entityId,
        options?.fromStatus,
        options?.toStatus,
        description,
        operator,
        timestamp,
        metadataStr,
      ],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

export async function getEntityHistory(
  entityType: string,
  entityId: string,
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<{ logs: OperationLog[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get<{ total: number }>(
        `SELECT COUNT(*) as total FROM operation_logs 
         WHERE entity_type = ? AND entity_id = ?`,
        [entityType, entityId],
        (err, countResult) => {
          if (err) return reject(err);

          db.all<{
            id: string;
            operation_type: string;
            entity_type: string;
            entity_id: string;
            from_status?: string;
            to_status?: string;
            description: string;
            operator: string;
            timestamp: string;
            metadata?: string;
          }>(
            `SELECT * FROM operation_logs 
             WHERE entity_type = ? AND entity_id = ?
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?`,
            [entityType, entityId, pageSize, offset],
            (err, rows) => {
              if (err) return reject(err);

              const logs: OperationLog[] = rows.map((row) => ({
                id: row.id,
                operationType: row.operation_type as OperationType,
                entityType: row.entity_type,
                entityId: row.entity_id,
                fromStatus: row.from_status,
                toStatus: row.to_status,
                description: row.description,
                operator: row.operator,
                timestamp: row.timestamp,
                metadata: deserializeMetadata(row.metadata),
              }));

              resolve({
                logs,
                total: countResult?.total || 0,
              });
            }
          );
        }
      );
    });
  });
}

export async function getAllLogs(options?: {
  page?: number;
  pageSize?: number;
  operationType?: OperationType;
  entityType?: string;
}): Promise<{ logs: OperationLog[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options?.operationType) {
    conditions.push('operation_type = ?');
    params.push(options.operationType);
  }
  if (options?.entityType) {
    conditions.push('entity_type = ?');
    params.push(options.entityType);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.get<{ total: number }>(
        `SELECT COUNT(*) as total FROM operation_logs ${whereClause}`,
        params,
        (err, countResult) => {
          if (err) return reject(err);

          params.push(pageSize, offset);
          db.all<{
            id: string;
            operation_type: string;
            entity_type: string;
            entity_id: string;
            from_status?: string;
            to_status?: string;
            description: string;
            operator: string;
            timestamp: string;
            metadata?: string;
          }>(
            `SELECT * FROM operation_logs ${whereClause}
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?`,
            params,
            (err, rows) => {
              if (err) return reject(err);

              const logs: OperationLog[] = rows.map((row) => ({
                id: row.id,
                operationType: row.operation_type as OperationType,
                entityType: row.entity_type,
                entityId: row.entity_id,
                fromStatus: row.from_status,
                toStatus: row.to_status,
                description: row.description,
                operator: row.operator,
                timestamp: row.timestamp,
                metadata: deserializeMetadata(row.metadata),
              }));

              resolve({
                logs,
                total: countResult?.total || 0,
              });
            }
          );
        }
      );
    });
  });
}
