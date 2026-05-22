import { getDatabase } from '../database/init.js';
import crypto from 'crypto';

export interface AuditLogInput {
  userId: string;
  userName: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  failureReason?: string;
}

export function createAuditLog(input: AuditLogInput): string {
  const db = getDatabase();
  const id = crypto.randomUUID();
  
  const stmt = db.prepare(`
    INSERT INTO audit_logs (
      id, user_id, user_name, action, resource_type, resource_id,
      ip_address, user_agent, success, failure_reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.userId,
    input.userName,
    input.action,
    input.resourceType || null,
    input.resourceId || null,
    input.ipAddress || null,
    input.userAgent || null,
    input.success ? 1 : 0,
    input.failureReason || null
  );

  db.close();
  return id;
}

export function getAuditLogs(
  page: number = 1,
  pageSize: number = 20,
  filters?: {
    userId?: string;
    action?: string;
    success?: boolean;
    startDate?: string;
    endDate?: string;
  }
) {
  const db = getDatabase();
  
  let whereClauses: string[] = [];
  let params: any[] = [];

  if (filters?.userId) {
    whereClauses.push('user_id = ?');
    params.push(filters.userId);
  }
  if (filters?.action) {
    whereClauses.push('action = ?');
    params.push(filters.action);
  }
  if (filters?.success !== undefined) {
    whereClauses.push('success = ?');
    params.push(filters.success ? 1 : 0);
  }
  if (filters?.startDate) {
    whereClauses.push('created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    whereClauses.push('created_at <= ?');
    params.push(filters.endDate);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${whereSql}`);
  const totalResult = countStmt.get(...params) as { total: number };

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const logsStmt = db.prepare(`
    SELECT * FROM audit_logs ${whereSql}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `);

  const logs = logsStmt.all(...params);
  db.close();

  return {
    logs,
    total: totalResult.total,
    page,
    pageSize,
    totalPages: Math.ceil(totalResult.total / pageSize)
  };
}

export function getPermissionDeniedCount(): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM audit_logs 
    WHERE success = 0 AND failure_reason LIKE '%PERMISSION_DENIED%'
  `);
  const result = stmt.get() as { count: number };
  db.close();
  return result.count;
}
