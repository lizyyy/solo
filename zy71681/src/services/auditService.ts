import { v4 as uuidv4 } from 'uuid';
import { runQuery, allQuery } from '../database';
import { AuditLog } from '../types';

export const createAuditLog = async (
  entityType: AuditLog['entityType'],
  entityId: string,
  action: AuditLog['action'],
  description: string,
  fieldName?: string,
  oldValue?: string,
  newValue?: string,
  operator?: string
): Promise<void> => {
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  await runQuery(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, field_name, old_value, new_value, operator, timestamp, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, entityType, entityId, action, fieldName, oldValue, newValue, operator, timestamp, description]
  );
};

export const getAuditLogsByEntity = async (
  entityType: AuditLog['entityType'],
  entityId: string
): Promise<AuditLog[]> => {
  const rows = await allQuery(
    `SELECT id, entity_type as entityType, entity_id as entityId, action, field_name as fieldName,
            old_value as oldValue, new_value as newValue, operator, timestamp, description
     FROM audit_logs
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY timestamp DESC`,
    [entityType, entityId]
  );
  return rows as AuditLog[];
};

export const getAllAuditLogs = async (limit: number = 100): Promise<AuditLog[]> => {
  const rows = await allQuery(
    `SELECT id, entity_type as entityType, entity_id as entityId, action, field_name as fieldName,
            old_value as oldValue, new_value as newValue, operator, timestamp, description
     FROM audit_logs
     ORDER BY timestamp DESC
     LIMIT ?`,
    [limit]
  );
  return rows as AuditLog[];
};

export const getSupplementHistory = async (
  entityType: AuditLog['entityType'],
  entityId: string
): Promise<AuditLog[]> => {
  const rows = await allQuery(
    `SELECT id, entity_type as entityType, entity_id as entityId, action, field_name as fieldName,
            old_value as oldValue, new_value as newValue, operator, timestamp, description
     FROM audit_logs
     WHERE entity_type = ? AND entity_id = ? AND action = 'supplement'
     ORDER BY timestamp DESC`,
    [entityType, entityId]
  );
  return rows as AuditLog[];
};
