"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
exports.listAuditLogs = listAuditLogs;
const uuid_1 = require("uuid");
const database_1 = require("../database");
function createAuditLog(params) {
    const db = (0, database_1.getDatabase)();
    const id = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    const stmt = db.prepare(`
    INSERT INTO audit_logs (
      id, operation_type, target_type, target_id, user_id, user_name,
      detail, ip, user_agent, created_at, success, error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(id, params.operationType, params.targetType, params.targetId, params.userId, params.userName, params.detail, params.ip || 'localhost', params.userAgent || 'desktop', now, params.success ? 1 : 0, params.errorMessage || null);
}
function listAuditLogs(params) {
    const db = (0, database_1.getDatabase)();
    const { page, pageSize, operationType, userId, startDate, endDate } = params;
    const conditions = [];
    const values = [];
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
    const countResult = countStmt.get(...values);
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
    const rows = dataStmt.all(...values, pageSize, offset);
    const data = rows.map(row => ({
        ...row,
        operationType: row.operationType,
        success: row.success === 1
    }));
    return {
        data,
        total,
        page,
        pageSize
    };
}
