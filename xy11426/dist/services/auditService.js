"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = logAudit;
exports.getAuditLogsByBatch = getAuditLogsByBatch;
exports.getAuditLogsByRecord = getAuditLogsByRecord;
exports.getAuditLogsByOperator = getAuditLogsByOperator;
exports.getAllAuditLogs = getAllAuditLogs;
exports.getRecordChangeHistory = getRecordChangeHistory;
const database_1 = require("../db/database");
const utils_1 = require("../utils");
function logAudit(options) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    INSERT INTO audit_logs (
      id, batch_id, record_id, operator, action, old_value, new_value, ip, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run((0, utils_1.generateId)(), options.batchId || null, options.recordId || null, options.operator, options.action, options.oldValue !== undefined ? JSON.stringify(options.oldValue) : null, options.newValue !== undefined ? JSON.stringify(options.newValue) : null, options.ip || null, (0, utils_1.now)());
}
function getAuditLogsByBatch(batchId, limit = 100) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE batch_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
    return stmt.all(batchId, limit);
}
function getAuditLogsByRecord(recordId, limit = 100) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE record_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
    return stmt.all(recordId, limit);
}
function getAuditLogsByOperator(operator, limit = 100) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE operator = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
    return stmt.all(operator, limit);
}
function getAllAuditLogs(limit = 1000) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    SELECT * FROM audit_logs 
    ORDER BY created_at DESC 
    LIMIT ?
  `);
    return stmt.all(limit);
}
function getRecordChangeHistory(recordId) {
    const db = (0, database_1.getDatabase)();
    const stmt = db.prepare(`
    SELECT 
      operator,
      action,
      old_value,
      new_value,
      created_at
    FROM audit_logs 
    WHERE record_id = ? 
    ORDER BY created_at ASC
  `);
    return stmt.all(recordId);
}
