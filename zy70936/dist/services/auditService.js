"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
exports.getAuditLogsForRecord = getAuditLogsForRecord;
exports.getAuditLogsByOperator = getAuditLogsByOperator;
const database_1 = require("../database");
const id_1 = require("../utils/id");
function createAuditLog(recordId, action, reason, operator, details = {}) {
    const db = (0, database_1.getDb)();
    const logId = (0, id_1.generateId)('log');
    const timestamp = Date.now();
    db.prepare(`
    INSERT INTO audit_logs (id, record_id, action, reason, operator, timestamp, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(logId, recordId, action, reason, operator, timestamp, JSON.stringify(details));
    return {
        id: logId,
        recordId,
        action,
        reason,
        operator,
        timestamp,
        details
    };
}
function getAuditLogsForRecord(recordId) {
    const db = (0, database_1.getDb)();
    const rows = db.prepare(`
    SELECT * FROM audit_logs WHERE record_id = ? ORDER BY timestamp DESC
  `).all(recordId);
    return rows.map(row => ({
        id: row.id,
        recordId: row.record_id,
        action: row.action,
        reason: row.reason,
        operator: row.operator,
        timestamp: row.timestamp,
        details: JSON.parse(row.details || '{}')
    }));
}
function getAuditLogsByOperator(operator, limit = 100) {
    const db = (0, database_1.getDb)();
    const rows = db.prepare(`
    SELECT * FROM audit_logs WHERE operator = ? ORDER BY timestamp DESC LIMIT ?
  `).all(operator, limit);
    return rows.map(row => ({
        id: row.id,
        recordId: row.record_id,
        action: row.action,
        reason: row.reason,
        operator: row.operator,
        timestamp: row.timestamp,
        details: JSON.parse(row.details || '{}')
    }));
}
