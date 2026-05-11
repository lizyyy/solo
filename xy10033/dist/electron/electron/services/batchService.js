"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchChangeStatus = batchChangeStatus;
exports.batchAssignOrders = batchAssignOrders;
exports.recordFailedOperation = recordFailedOperation;
exports.listFailedOperations = listFailedOperations;
exports.retryFailedOperation = retryFailedOperation;
exports.clearFailedOperation = clearFailedOperation;
const uuid_1 = require("uuid");
const types_1 = require("../../shared/types");
const database_1 = require("../database");
const reorderService_1 = require("./reorderService");
const auditService_1 = require("./auditService");
const constants_1 = require("../../shared/constants");
function batchChangeStatus(orderIds, newStatus, changeReason, operator) {
    const success = [];
    const failed = [];
    orderIds.forEach(orderId => {
        try {
            (0, reorderService_1.changeOrderStatus)(orderId, newStatus, changeReason, operator);
            success.push(orderId);
        }
        catch (error) {
            failed.push({ orderId, error: error.message });
            recordFailedOperation(orderId, 'status_change', error.message);
        }
    });
    (0, auditService_1.createAuditLog)({
        operationType: types_1.OperationType.UPDATE,
        targetType: 'order',
        targetId: null,
        userId: operator.id,
        userName: operator.name,
        detail: `批量更新订单状态: ${newStatus}, 成功: ${success.length}, 失败: ${failed.length}`,
        success: failed.length === 0,
        errorMessage: failed.length > 0 ? `有 ${failed.length} 个订单更新失败` : undefined
    });
    return { success, failed };
}
function batchAssignOrders(orderIds, assigneeId, assigneeName, operator) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const success = [];
    const failed = [];
    const stmt = db.prepare(`
    UPDATE reissue_orders 
    SET assignee_id = ?, assignee_name = ?, updated_at = ?
    WHERE id = ?
  `);
    orderIds.forEach(orderId => {
        try {
            const order = (0, reorderService_1.getOrderById)(orderId);
            if (!order) {
                throw new Error('订单不存在');
            }
            stmt.run(assigneeId, assigneeName, now, orderId);
            success.push(orderId);
        }
        catch (error) {
            failed.push({ orderId, error: error.message });
        }
    });
    (0, auditService_1.createAuditLog)({
        operationType: types_1.OperationType.UPDATE,
        targetType: 'order',
        targetId: null,
        userId: operator.id,
        userName: operator.name,
        detail: `批量分配订单: ${assigneeName}, 成功: ${success.length}, 失败: ${failed.length}`,
        success: failed.length === 0,
        errorMessage: failed.length > 0 ? `有 ${failed.length} 个订单分配失败` : undefined
    });
    return { success, failed };
}
function recordFailedOperation(targetId, operationType, errorMessage) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const existing = db.prepare(`
    SELECT id, retry_count as retryCount FROM failed_operations 
    WHERE target_id = ? AND operation_type = ?
  `).get(targetId, operationType);
    if (existing) {
        const newRetryCount = existing.retryCount + 1;
        db.prepare(`
      UPDATE failed_operations 
      SET retry_count = ?, last_attempt_at = ?, error_message = ?
      WHERE id = ?
    `).run(newRetryCount, now, errorMessage, existing.id);
    }
    else {
        const id = (0, uuid_1.v4)();
        db.prepare(`
      INSERT INTO failed_operations (
        id, operation_type, target_id, error_message,
        retry_count, max_retries, last_attempt_at, created_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, operationType, targetId, errorMessage, constants_1.MAX_RETRY_COUNT, now, now);
    }
}
function listFailedOperations() {
    const db = (0, database_1.getDatabase)();
    const rows = db.prepare(`
    SELECT 
      id, operation_type as operationType, target_id as targetId,
      error_message as errorMessage, retry_count as retryCount,
      max_retries as maxRetries, last_attempt_at as lastAttemptAt,
      created_at as createdAt
    FROM failed_operations
    ORDER BY last_attempt_at DESC
  `).all();
    return rows.map(row => ({
        ...row,
        retryCount: Number(row.retryCount),
        maxRetries: Number(row.maxRetries)
    }));
}
function retryFailedOperation(failedOpId, operator) {
    const db = (0, database_1.getDatabase)();
    const failedOp = db.prepare(`
    SELECT * FROM failed_operations WHERE id = ?
  `).get(failedOpId);
    if (!failedOp) {
        return { success: false, message: '失败操作记录不存在' };
    }
    try {
        if (failedOp.operation_type === 'status_change') {
            const order = (0, reorderService_1.getOrderById)(failedOp.target_id);
            if (!order) {
                throw new Error('订单不存在');
            }
            if (order.status === types_1.ReissueStatus.FAILED) {
                (0, reorderService_1.changeOrderStatus)(failedOp.target_id, types_1.ReissueStatus.PROCESSING, '重试处理', operator);
            }
            else {
                return { success: false, message: '订单状态不是失败状态，无法重试' };
            }
        }
        db.prepare('DELETE FROM failed_operations WHERE id = ?').run(failedOpId);
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.RETRY,
            targetType: 'failed_operation',
            targetId: failedOpId,
            userId: operator.id,
            userName: operator.name,
            detail: `重试失败操作: ${failedOp.operation_type}`,
            success: true
        });
        return { success: true, message: '重试成功' };
    }
    catch (error) {
        return { success: false, message: error.message };
    }
}
function clearFailedOperation(failedOpId, operator) {
    const db = (0, database_1.getDatabase)();
    const result = db.prepare('DELETE FROM failed_operations WHERE id = ?').run(failedOpId);
    if (result.changes > 0) {
        (0, auditService_1.createAuditLog)({
            operationType: types_1.OperationType.DELETE,
            targetType: 'failed_operation',
            targetId: failedOpId,
            userId: operator.id,
            userName: operator.name,
            detail: `清除失败操作记录`,
            success: true
        });
        return true;
    }
    return false;
}
