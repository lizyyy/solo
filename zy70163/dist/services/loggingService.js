"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logOperation = logOperation;
exports.getLogsByObject = getLogsByObject;
exports.getLogsByTimeRange = getLogsByTimeRange;
exports.getFailedOperations = getFailedOperations;
const uuid_1 = require("uuid");
const index_1 = require("../database/index");
async function logOperation(params) {
    const logId = (0, uuid_1.v4)();
    const timestamp = new Date().toISOString();
    await (0, index_1.runSql)(`INSERT INTO operation_logs (
      log_id, operation, object_id, bucket_name, object_key,
      request_id, user_id, timestamp, status, details, cost_estimate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        logId,
        params.operation,
        params.objectId,
        params.bucketName,
        params.objectKey,
        params.requestId,
        params.userId,
        timestamp,
        params.status,
        params.details,
        params.costEstimate
    ]);
    return logId;
}
async function getLogsByObject(objectId) {
    const rows = await (0, index_1.querySql)(`SELECT * FROM operation_logs WHERE object_id = ? ORDER BY timestamp DESC`, [objectId]);
    return rows.map(row => ({
        logId: row.log_id,
        operation: row.operation,
        objectId: row.object_id,
        bucketName: row.bucket_name,
        objectKey: row.object_key,
        requestId: row.request_id,
        userId: row.user_id,
        timestamp: row.timestamp,
        status: row.status,
        details: row.details,
        costEstimate: row.cost_estimate
    }));
}
async function getLogsByTimeRange(startTime, endTime, userId) {
    let sql = `SELECT * FROM operation_logs WHERE timestamp >= ? AND timestamp <= ?`;
    const params = [startTime, endTime];
    if (userId) {
        sql += ` AND user_id = ?`;
        params.push(userId);
    }
    sql += ` ORDER BY timestamp DESC`;
    const rows = await (0, index_1.querySql)(sql, params);
    return rows.map(row => ({
        logId: row.log_id,
        operation: row.operation,
        objectId: row.object_id,
        bucketName: row.bucket_name,
        objectKey: row.object_key,
        requestId: row.request_id,
        userId: row.user_id,
        timestamp: row.timestamp,
        status: row.status,
        details: row.details,
        costEstimate: row.cost_estimate
    }));
}
async function getFailedOperations(limit = 100) {
    const rows = await (0, index_1.querySql)(`SELECT * FROM operation_logs WHERE status = 'failed' ORDER BY timestamp DESC LIMIT ?`, [limit]);
    return rows.map(row => ({
        logId: row.log_id,
        operation: row.operation,
        objectId: row.object_id,
        bucketName: row.bucket_name,
        objectKey: row.object_key,
        requestId: row.request_id,
        userId: row.user_id,
        timestamp: row.timestamp,
        status: row.status,
        details: row.details,
        costEstimate: row.cost_estimate
    }));
}
