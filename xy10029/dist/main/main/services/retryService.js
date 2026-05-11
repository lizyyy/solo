"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordFailedOperation = recordFailedOperation;
exports.getPendingRetryOperations = getPendingRetryOperations;
exports.updateRetryAttempt = updateRetryAttempt;
exports.cancelRetry = cancelRetry;
exports.getFailedOperations = getFailedOperations;
exports.executeWithRetry = executeWithRetry;
const index_1 = require("../database/index");
const types_1 = require("@shared/types");
const utils_1 = require("@shared/utils");
async function recordFailedOperation(operationType, details, errorMessage, maxRetries = 3) {
    const now = (0, utils_1.getCurrentTimestamp)();
    const operation = {
        id: (0, utils_1.generateId)(),
        operationType,
        details,
        errorMessage,
        retryCount: 0,
        maxRetries,
        status: types_1.RetryStatus.PENDING,
        lastAttemptAt: now,
        nextRetryAt: (0, utils_1.calculateNextRetry)(0, now),
        createdAt: now
    };
    await (0, index_1.run)(`
    INSERT INTO failed_operations (
      id, operation_type, details, error_message, retry_count,
      max_retries, status, last_attempt_at, next_retry_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        operation.id,
        operation.operationType,
        operation.details,
        operation.errorMessage,
        operation.retryCount,
        operation.maxRetries,
        operation.status,
        operation.lastAttemptAt,
        operation.nextRetryAt,
        operation.createdAt
    ]);
    return operation;
}
async function getPendingRetryOperations() {
    const now = (0, utils_1.getCurrentTimestamp)();
    const rows = await (0, index_1.all)(`
    SELECT * FROM failed_operations
    WHERE status IN (?, ?) AND next_retry_at <= ?
    ORDER BY next_retry_at ASC
  `, [types_1.RetryStatus.PENDING, types_1.RetryStatus.RETRYING, now]);
    return rows.map(mapFailedOperation);
}
async function updateRetryAttempt(id, success, errorMessage) {
    const operation = await getFailedOperationById(id);
    if (!operation)
        return null;
    const now = (0, utils_1.getCurrentTimestamp)();
    const newRetryCount = operation.retryCount + 1;
    let newStatus;
    let nextRetryAt = null;
    if (success) {
        newStatus = types_1.RetryStatus.SUCCESS;
    }
    else if (newRetryCount >= operation.maxRetries) {
        newStatus = types_1.RetryStatus.FAILED;
    }
    else {
        newStatus = types_1.RetryStatus.RETRYING;
        nextRetryAt = (0, utils_1.calculateNextRetry)(newRetryCount, now);
    }
    await (0, index_1.run)(`
    UPDATE failed_operations SET
      retry_count = ?,
      status = ?,
      last_attempt_at = ?,
      next_retry_at = ?,
      error_message = ?
    WHERE id = ?
  `, [
        newRetryCount,
        newStatus,
        now,
        nextRetryAt,
        errorMessage || operation.errorMessage,
        id
    ]);
    return getFailedOperationById(id);
}
async function cancelRetry(id) {
    await (0, index_1.run)('UPDATE failed_operations SET status = ? WHERE id = ?', [types_1.RetryStatus.CANCELLED, id]);
    return getFailedOperationById(id);
}
async function getFailedOperations(params) {
    const { page, pageSize, sortBy = 'created_at', sortOrder = 'desc', status } = params;
    const whereClauses = [];
    const whereParams = [];
    if (status) {
        whereClauses.push('status = ?');
        whereParams.push(status);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const countRow = await (0, index_1.get)(`SELECT COUNT(*) as count FROM failed_operations ${whereSql}`, whereParams);
    const total = countRow?.count || 0;
    const offset = (page - 1) * pageSize;
    const rows = await (0, index_1.all)(`SELECT * FROM failed_operations ${whereSql} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`, [...whereParams, pageSize, offset]);
    return {
        items: rows.map(mapFailedOperation),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
    };
}
async function executeWithRetry(operation, operationType, details, maxRetries = 3, onRetry) {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (onRetry) {
                onRetry(attempt + 1, lastError);
            }
            if (attempt < maxRetries - 1) {
                const delay = 1000 * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    await recordFailedOperation(operationType, details, lastError.message, maxRetries);
    throw lastError;
}
async function getFailedOperationById(id) {
    const row = await (0, index_1.get)('SELECT * FROM failed_operations WHERE id = ?', [id]);
    return row ? mapFailedOperation(row) : null;
}
function mapFailedOperation(row) {
    return {
        id: row.id,
        operationType: row.operation_type,
        details: row.details,
        errorMessage: row.error_message,
        retryCount: row.retry_count,
        maxRetries: row.max_retries,
        status: row.status,
        lastAttemptAt: row.last_attempt_at,
        nextRetryAt: row.next_retry_at,
        createdAt: row.created_at
    };
}
//# sourceMappingURL=retryService.js.map