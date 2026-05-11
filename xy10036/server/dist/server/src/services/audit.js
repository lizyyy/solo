"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
exports.getAuditLogs = getAuditLogs;
const uuid_1 = require("uuid");
const database_1 = require("../database");
async function createAuditLog(params) {
    const now = new Date().toISOString();
    await database_1.db.run(`INSERT INTO audit_logs (
      id, action, entity_type, entity_id, entity_name, 
      operator_id, operator_name, before, after, 
      request_id, ip, user_agent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        (0, uuid_1.v4)(),
        params.action,
        params.entityType,
        params.entityId,
        params.entityName,
        params.operatorId,
        params.operatorName,
        params.before ? JSON.stringify(params.before) : null,
        params.after ? JSON.stringify(params.after) : null,
        params.requestId,
        params.ip,
        params.userAgent,
        now
    ]);
}
async function getAuditLogs(query) {
    const conditions = [];
    const params = [];
    if (query.entityType) {
        conditions.push('entity_type = ?');
        params.push(query.entityType);
    }
    if (query.entityId) {
        conditions.push('entity_id = ?');
        params.push(query.entityId);
    }
    if (query.operatorId) {
        conditions.push('operator_id = ?');
        params.push(query.operatorId);
    }
    if (query.action) {
        conditions.push('action = ?');
        params.push(query.action);
    }
    if (query.startTime) {
        conditions.push('created_at >= ?');
        params.push(query.startTime);
    }
    if (query.endTime) {
        conditions.push('created_at <= ?');
        params.push(query.endTime);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await database_1.db.get(`SELECT COUNT(*) as total FROM audit_logs ${whereClause}`, params);
    const offset = (query.page - 1) * query.pageSize;
    const rows = await database_1.db.all(`SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, query.pageSize, offset]);
    return {
        items: rows.map(mapDbAuditLog),
        total: countResult?.total || 0
    };
}
function mapDbAuditLog(row) {
    return {
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        entityName: row.entity_name,
        operatorId: row.operator_id,
        operatorName: row.operator_name,
        before: row.before ? JSON.parse(row.before) : undefined,
        after: row.after ? JSON.parse(row.after) : undefined,
        requestId: row.request_id,
        ip: row.ip,
        userAgent: row.user_agent,
        createdAt: row.created_at
    };
}
//# sourceMappingURL=audit.js.map