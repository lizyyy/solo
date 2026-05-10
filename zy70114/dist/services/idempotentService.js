"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredIdempotent = exports.getOperationLogs = exports.logOperation = exports.saveIdempotentResponse = exports.checkIdempotent = void 0;
const database_1 = require("../database");
const IDEMPOTENT_TTL_MS = 24 * 60 * 60 * 1000;
const checkIdempotent = (requestKey) => {
    if (!requestKey)
        return null;
    const existing = (0, database_1.executeGet)('SELECT * FROM idempotent_requests WHERE request_key = ? AND expires_at > ?', [requestKey, (0, database_1.now)()]);
    return existing;
};
exports.checkIdempotent = checkIdempotent;
const saveIdempotentResponse = (requestKey, requestType, responseData) => {
    const db = (0, database_1.getDb)();
    const existing = (0, exports.checkIdempotent)(requestKey);
    if (existing) {
        return existing;
    }
    const request = {
        id: (0, database_1.generateId)(),
        request_key: requestKey,
        request_type: requestType,
        response_data: responseData,
        created_at: (0, database_1.now)(),
        expires_at: (0, database_1.now)() + IDEMPOTENT_TTL_MS,
    };
    db.run(`
    INSERT INTO idempotent_requests (
      id, request_key, request_type, response_data, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `, [
        request.id,
        request.request_key,
        request.request_type,
        request.response_data,
        request.created_at,
        request.expires_at,
    ]);
    (0, database_1.saveDatabase)();
    return request;
};
exports.saveIdempotentResponse = saveIdempotentResponse;
const logOperation = (orderId, operatorId, operatorRole, operationType, operationDetail, oldData, newData) => {
    const db = (0, database_1.getDb)();
    const log = {
        id: (0, database_1.generateId)(),
        order_id: orderId,
        operator_id: operatorId,
        operator_role: operatorRole,
        operation_type: operationType,
        operation_detail: operationDetail || null,
        old_data: oldData ? JSON.stringify(oldData) : null,
        new_data: newData ? JSON.stringify(newData) : null,
        created_at: (0, database_1.now)(),
    };
    db.run(`
    INSERT INTO operation_logs (
      id, order_id, operator_id, operator_role, operation_type,
      operation_detail, old_data, new_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        log.id,
        log.order_id,
        log.operator_id,
        log.operator_role,
        log.operation_type,
        log.operation_detail,
        log.old_data,
        log.new_data,
        log.created_at,
    ]);
    return log;
};
exports.logOperation = logOperation;
const getOperationLogs = (orderId, limit = 50) => {
    return (0, database_1.executeAll)(`SELECT * FROM operation_logs WHERE order_id = ? ORDER BY created_at DESC LIMIT ?`, [orderId, limit]);
};
exports.getOperationLogs = getOperationLogs;
const cleanupExpiredIdempotent = () => {
    const db = (0, database_1.getDb)();
    const before = (0, database_1.now)();
    db.run('DELETE FROM idempotent_requests WHERE expires_at < ?', [before]);
    const changes = db.getRowsModified();
    if (changes > 0) {
        (0, database_1.saveDatabase)();
    }
    return changes;
};
exports.cleanupExpiredIdempotent = cleanupExpiredIdempotent;
//# sourceMappingURL=idempotentService.js.map