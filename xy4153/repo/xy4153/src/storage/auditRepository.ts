import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { AuditLog, VersionRecord, User, UserRole } from '../types';

function mapRowToAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    userId: row.user_id,
    username: row.username,
    userRole: row.user_role as UserRole,
    beforeState: row.before_state ? JSON.parse(row.before_state) : undefined,
    afterState: row.after_state ? JSON.parse(row.after_state) : undefined,
    changes: row.changes ? JSON.parse(row.changes) : undefined,
    timestamp: row.timestamp,
    ipAddress: row.ip_address,
    userAgent: row.user_agent
  };
}

function mapRowToVersionRecord(row: any): VersionRecord {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    version: row.version,
    state: JSON.parse(row.state),
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

export function createAuditLog(
  entityType: string,
  entityId: string,
  action: string,
  user: User,
  options?: {
    beforeState?: Record<string, any>;
    afterState?: Record<string, any>;
    changes?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }
): AuditLog {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO audit_logs (
      id, entity_type, entity_id, action, user_id, username, user_role,
      before_state, after_state, changes, timestamp, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    id, entityType, entityId, action, user.id, user.username, user.role,
    options?.beforeState ? JSON.stringify(options.beforeState) : null,
    options?.afterState ? JSON.stringify(options.afterState) : null,
    options?.changes ? JSON.stringify(options.changes) : null,
    now,
    options?.ipAddress || null,
    options?.userAgent || null
  );

  return {
    id,
    entityType,
    entityId,
    action,
    userId: user.id,
    username: user.username,
    userRole: user.role,
    beforeState: options?.beforeState,
    afterState: options?.afterState,
    changes: options?.changes,
    timestamp: now,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent
  };
}

export function getAuditLogs(
  options?: {
    entityType?: string;
    entityId?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): AuditLog[] {
  const db = getDatabase();
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];

  if (options?.entityType) {
    query += ' AND entity_type = ?';
    params.push(options.entityType);
  }
  if (options?.entityId) {
    query += ' AND entity_id = ?';
    params.push(options.entityId);
  }
  if (options?.action) {
    query += ' AND action = ?';
    params.push(options.action);
  }
  if (options?.userId) {
    query += ' AND user_id = ?';
    params.push(options.userId);
  }
  if (options?.startDate) {
    query += ' AND timestamp >= ?';
    params.push(options.startDate);
  }
  if (options?.endDate) {
    query += ' AND timestamp <= ?';
    params.push(options.endDate);
  }

  query += ' ORDER BY timestamp DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = db.prepare(query).all(...params);
  return rows.map(mapRowToAuditLog);
}

export function createVersionRecord(
  entityType: string,
  entityId: string,
  state: Record<string, any>,
  createdBy: User
): VersionRecord {
  const db = getDatabase();
  const now = new Date().toISOString();

  const maxVersionRow = db.prepare(`
    SELECT MAX(version) as max_version FROM version_records 
    WHERE entity_type = ? AND entity_id = ?
  `).get(entityType, entityId) as { max_version: number | null };

  const version = (maxVersionRow.max_version || 0) + 1;
  const id = uuidv4();

  const insert = db.prepare(`
    INSERT INTO version_records (
      id, entity_type, entity_id, version, state, created_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(id, entityType, entityId, version, JSON.stringify(state), now, createdBy.id);

  return {
    id,
    entityType,
    entityId,
    version,
    state,
    createdAt: now,
    createdBy: createdBy.id
  };
}

export function getVersionRecords(
  entityType: string,
  entityId: string
): VersionRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM version_records 
    WHERE entity_type = ? AND entity_id = ? 
    ORDER BY version DESC
  `).all(entityType, entityId);
  return rows.map(mapRowToVersionRecord);
}

export function getLatestVersion(
  entityType: string,
  entityId: string
): VersionRecord | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM version_records 
    WHERE entity_type = ? AND entity_id = ? 
    ORDER BY version DESC 
    LIMIT 1
  `).get(entityType, entityId);
  
  if (!row) return null;
  return mapRowToVersionRecord(row);
}
