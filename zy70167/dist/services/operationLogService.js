"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logOperation = logOperation;
exports.getEntityHistory = getEntityHistory;
exports.getAllLogs = getAllLogs;
const uuid_1 = require("uuid");
const moment_1 = __importDefault(require("moment"));
const init_1 = __importDefault(require("../database/init"));
function serializeMetadata(metadata) {
    if (!metadata)
        return undefined;
    try {
        return JSON.stringify(metadata);
    }
    catch {
        return undefined;
    }
}
function deserializeMetadata(metadataStr) {
    if (!metadataStr)
        return undefined;
    try {
        return JSON.parse(metadataStr);
    }
    catch {
        return undefined;
    }
}
async function logOperation(operationType, entityType, entityId, description, operator, options) {
    const id = (0, uuid_1.v4)();
    const timestamp = (0, moment_1.default)().toISOString();
    const metadataStr = serializeMetadata(options?.metadata);
    return new Promise((resolve, reject) => {
        init_1.default.run(`INSERT INTO operation_logs (
        id, operation_type, entity_type, entity_id, from_status, to_status,
        description, operator, timestamp, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            operationType,
            entityType,
            entityId,
            options?.fromStatus,
            options?.toStatus,
            description,
            operator,
            timestamp,
            metadataStr,
        ], (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
}
async function getEntityHistory(entityType, entityId, options) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    return new Promise((resolve, reject) => {
        init_1.default.serialize(() => {
            init_1.default.get(`SELECT COUNT(*) as total FROM operation_logs 
         WHERE entity_type = ? AND entity_id = ?`, [entityType, entityId], (err, countResult) => {
                if (err)
                    return reject(err);
                init_1.default.all(`SELECT * FROM operation_logs 
             WHERE entity_type = ? AND entity_id = ?
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?`, [entityType, entityId, pageSize, offset], (err, rows) => {
                    if (err)
                        return reject(err);
                    const logs = rows.map((row) => ({
                        id: row.id,
                        operationType: row.operation_type,
                        entityType: row.entity_type,
                        entityId: row.entity_id,
                        fromStatus: row.from_status,
                        toStatus: row.to_status,
                        description: row.description,
                        operator: row.operator,
                        timestamp: row.timestamp,
                        metadata: deserializeMetadata(row.metadata),
                    }));
                    resolve({
                        logs,
                        total: countResult?.total || 0,
                    });
                });
            });
        });
    });
}
async function getAllLogs(options) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const conditions = [];
    const params = [];
    if (options?.operationType) {
        conditions.push('operation_type = ?');
        params.push(options.operationType);
    }
    if (options?.entityType) {
        conditions.push('entity_type = ?');
        params.push(options.entityType);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return new Promise((resolve, reject) => {
        init_1.default.serialize(() => {
            init_1.default.get(`SELECT COUNT(*) as total FROM operation_logs ${whereClause}`, params, (err, countResult) => {
                if (err)
                    return reject(err);
                params.push(pageSize, offset);
                init_1.default.all(`SELECT * FROM operation_logs ${whereClause}
             ORDER BY timestamp DESC
             LIMIT ? OFFSET ?`, params, (err, rows) => {
                    if (err)
                        return reject(err);
                    const logs = rows.map((row) => ({
                        id: row.id,
                        operationType: row.operation_type,
                        entityType: row.entity_type,
                        entityId: row.entity_id,
                        fromStatus: row.from_status,
                        toStatus: row.to_status,
                        description: row.description,
                        operator: row.operator,
                        timestamp: row.timestamp,
                        metadata: deserializeMetadata(row.metadata),
                    }));
                    resolve({
                        logs,
                        total: countResult?.total || 0,
                    });
                });
            });
        });
    });
}
//# sourceMappingURL=operationLogService.js.map