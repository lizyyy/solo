import { v4 as uuidv4 } from 'uuid';
import { AuditLog, OperationType, PaginatedResult } from '../../shared/types';
import { getDatabase } from '../database';

interface CreateAuditLogParams {
  operationType: OperationType;
  targetType: string;
  targetId: string | null;
  userId: string;
  userName: string;
  detail: string;
  success: boolean;
  errorMessage?: string;
  ip?: string;
  userAgent?: string;
}

export function createAuditLog(params: CreateAuditLogParams): void {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO audit_logs (
      id, operation_type, target_type, target_id, user_id, user_name,
      detail, ip, user_agent, created_at, success, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    params.operationType,
    params.targetType,
    params.targetId,
    params.userId,
    params.userName,
    params.detail,
    params.ip || 'localhost',
    params.userAgent || 'desktop',
    now,
    params.success ? 1 : 0,
    params.errorMessage || null
  );
}

export function listAuditLogs(params: {
  page: number;
  pageSize: number;
  operationType?: OperationType;
  userId?: string;
  startDate?: string;
  endDate?: string;
}): PaginatedResult<AuditLog> {
  const db = getDatabase();
  const { page, pageSize, operationType, userId, startDate, endDate } = params;
  
  const conditions: string[] = [];
  const values: any[] = [];
  
  if (operationType) {
    conditions.push('operation_type = ?');
    values.push(operationType);
  }
  if (userId) {
    conditions.push('user_id = ?');
    values.push(userId);
  }
  if (startDate) {
    conditions.push('created_at >= ?');
    values.push(startDate);
  }
  if (endDate) {
    conditions.push('created_at <= ?');
    values.push(endDate);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count FROM audit_logs ${whereClause}
  `);
  const countResult = countStmt.get(...values) as any;
  const total = countResult.count;
  
  const offset = (page - 1) * pageSize;
  const dataStmt = db.prepare(`
    SELECT 
      id, operation_type as operationType, target_type as targetType,
      target_id as targetId, user_id as userId, user_name as userName,
      detail, ip, user_agent as userAgent, created_at as createdAt,
      success, error_message as errorMessage
    FROM audit_logs ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  
  const rows = dataStmt.all(...values, pageSize, offset) as any[];
  
  const data = rows.map(row => ({
    ...row,
    operationType: row.operationType as OperationType,
    success: row.success === 1
  }));
  
  return {
    data,
    total,
    page,
    pageSize
  };
}
