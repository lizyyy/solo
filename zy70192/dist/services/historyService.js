"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllHistory = exports.getHistoryByEntity = exports.createHistoryRecord = void 0;
const uuid_1 = require("uuid");
const database_1 = __importDefault(require("../config/database"));
const createHistoryRecord = (entityType, entityId, action, description, operator, beforeState, afterState, ipAddress) => {
    const record = {
        id: (0, uuid_1.v4)(),
        entityType,
        entityId,
        action,
        description,
        beforeState,
        afterState,
        operator,
        operationTime: new Date().toISOString(),
        ipAddress
    };
    const stmt = database_1.default.prepare(`
    INSERT INTO history_records (id, entity_type, entity_id, action, description, before_state, after_state, operator, operation_time, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(record.id, record.entityType, record.entityId, record.action, record.description, beforeState ? JSON.stringify(beforeState) : null, afterState ? JSON.stringify(afterState) : null, record.operator, record.operationTime, record.ipAddress || null);
    return record;
};
exports.createHistoryRecord = createHistoryRecord;
const getHistoryByEntity = (entityType, entityId) => {
    const stmt = database_1.default.prepare(`
    SELECT * FROM history_records
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY operation_time DESC
  `);
    const rows = stmt.all(entityType, entityId);
    return rows.map(mapToHistoryRecord);
};
exports.getHistoryByEntity = getHistoryByEntity;
const getAllHistory = (entityType, startTime, endTime, operator, page = 1, pageSize = 20) => {
    let query = `
    SELECT * FROM history_records
    WHERE 1=1
  `;
    const params = [];
    if (entityType) {
        query += ' AND entity_type = ?';
        params.push(entityType);
    }
    if (startTime) {
        query += ' AND operation_time >= ?';
        params.push(startTime);
    }
    if (endTime) {
        query += ' AND operation_time <= ?';
        params.push(endTime);
    }
    if (operator) {
        query += ' AND operator LIKE ?';
        params.push(`%${operator}%`);
    }
    const countStmt = database_1.default.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as total'));
    const countResult = countStmt.get(...params);
    const total = countResult.total;
    query += ' ORDER BY operation_time DESC LIMIT ? OFFSET ?';
    params.push(pageSize, (page - 1) * pageSize);
    const stmt = database_1.default.prepare(query);
    const rows = stmt.all(...params);
    return {
        items: rows.map(mapToHistoryRecord),
        total
    };
};
exports.getAllHistory = getAllHistory;
const mapToHistoryRecord = (row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    description: row.description,
    beforeState: row.before_state ? JSON.parse(row.before_state) : undefined,
    afterState: row.after_state ? JSON.parse(row.after_state) : undefined,
    operator: row.operator,
    operationTime: row.operation_time,
    ipAddress: row.ip_address
});
