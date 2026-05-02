import { v4 as uuidv4 } from 'uuid';
import { run, get, all } from './database';
import { AuditLog, CreateAuditLogInput, AuditLogFilter } from '../types';

export function createAuditLog(input: CreateAuditLogInput): AuditLog {
  const now = new Date().toISOString();
  const id = uuidv4();

  const auditLog: AuditLog = {
    id,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    previousState: input.previousState || null,
    newState: input.newState || null,
    changes: input.changes || [],
    operator: input.operator,
    operatorRole: input.operatorRole || 'OPERATOR',
    timestamp: now,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent || null,
    notes: input.notes || null,
  };

  run(`
    INSERT INTO audit_logs (
      id, entity_type, entity_id, action, previous_state, new_state,
      changes, operator, operator_role, timestamp, ip_address, user_agent, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    auditLog.id,
    auditLog.entityType,
    auditLog.entityId,
    auditLog.action,
    auditLog.previousState ? JSON.stringify(auditLog.previousState) : null,
    auditLog.newState ? JSON.stringify(auditLog.newState) : null,
    JSON.stringify(auditLog.changes),
    auditLog.operator,
    auditLog.operatorRole,
    auditLog.timestamp,
    auditLog.ipAddress,
    auditLog.userAgent,
    auditLog.notes
  ]);

  return auditLog;
}

export function getAuditLogs(filter: AuditLogFilter = {}): AuditLog[] {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: unknown[] = [];

  if (filter.entityType) {
    query += ' AND entity_type = ?';
    params.push(filter.entityType);
  }
  if (filter.entityId) {
    query += ' AND entity_id = ?';
    params.push(filter.entityId);
  }
  if (filter.action) {
    query += ' AND action = ?';
    params.push(filter.action);
  }
  if (filter.operator) {
    query += ' AND operator = ?';
    params.push(filter.operator);
  }
  if (filter.startDate) {
    query += ' AND timestamp >= ?';
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    query += ' AND timestamp <= ?';
    params.push(filter.endDate);
  }

  query += ' ORDER BY timestamp DESC';

  const rows = all(query, params);
  return rows.map((row) => mapRowToAuditLog(row));
}

export function logBloodBagAction(
  bloodBagId: string,
  action: string,
  operator: string,
  options?: {
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    changes?: string[];
    notes?: string;
  }
): AuditLog {
  return createAuditLog({
    entityType: 'BLOOD_BAG',
    entityId: bloodBagId,
    action,
    previousState: options?.previousState,
    newState: options?.newState,
    changes: options?.changes,
    operator,
    notes: options?.notes,
  });
}

export function logApplicationAction(
  applicationId: string,
  action: string,
  operator: string,
  options?: {
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    changes?: string[];
    notes?: string;
  }
): AuditLog {
  return createAuditLog({
    entityType: 'APPLICATION',
    entityId: applicationId,
    action,
    previousState: options?.previousState,
    newState: options?.newState,
    changes: options?.changes,
    operator,
    notes: options?.notes,
  });
}

function mapRowToAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: row.id as string,
    entityType: row.entity_type as 'BLOOD_BAG' | 'APPLICATION' | 'WARD' | 'SYSTEM',
    entityId: row.entity_id as string,
    action: row.action as string,
    previousState: row.previous_state ? JSON.parse(row.previous_state as string) : null,
    newState: row.new_state ? JSON.parse(row.new_state as string) : null,
    changes: JSON.parse(row.changes as string),
    operator: row.operator as string,
    operatorRole: row.operator_role as string,
    timestamp: row.timestamp as string,
    ipAddress: row.ip_address as string | null,
    userAgent: row.user_agent as string | null,
    notes: row.notes as string | null,
  };
}
