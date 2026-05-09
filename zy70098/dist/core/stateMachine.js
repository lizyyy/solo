"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENROLLMENT_STATUS_TRANSITIONS = exports.BATCH_STATUS_TRANSITIONS = void 0;
exports.validateStateTransition = validateStateTransition;
exports.createEventRecord = createEventRecord;
exports.getAvailableOperations = getAvailableOperations;
exports.canPerformOperation = canPerformOperation;
const types_1 = require("../types");
const uuid_1 = require("uuid");
exports.BATCH_STATUS_TRANSITIONS = [
    {
        entityType: 'batch',
        fromStatus: types_1.InvitationBatchStatus.DRAFT,
        toStatus: types_1.InvitationBatchStatus.PUBLISHED,
        allowedOperations: ['publish'],
        errorMessage: '草稿状态下只能执行发布操作'
    },
    {
        entityType: 'batch',
        fromStatus: types_1.InvitationBatchStatus.DRAFT,
        toStatus: types_1.InvitationBatchStatus.CANCELLED,
        allowedOperations: ['cancel'],
        errorMessage: '草稿状态下只能执行取消操作'
    },
    {
        entityType: 'batch',
        fromStatus: types_1.InvitationBatchStatus.PUBLISHED,
        toStatus: types_1.InvitationBatchStatus.ENROLLMENT_STARTED,
        allowedOperations: ['start_enrollment'],
        errorMessage: '已发布状态下只能执行开始报名操作'
    },
    {
        entityType: 'batch',
        fromStatus: types_1.InvitationBatchStatus.PUBLISHED,
        toStatus: types_1.InvitationBatchStatus.CANCELLED,
        allowedOperations: ['cancel'],
        errorMessage: '已发布状态下只能执行取消操作'
    },
    {
        entityType: 'batch',
        fromStatus: types_1.InvitationBatchStatus.ENROLLMENT_STARTED,
        toStatus: types_1.InvitationBatchStatus.ENROLLMENT_CLOSED,
        allowedOperations: ['close_enrollment'],
        errorMessage: '报名中状态下只能执行结束报名操作'
    },
    {
        entityType: 'batch',
        fromStatus: types_1.InvitationBatchStatus.ENROLLMENT_CLOSED,
        toStatus: types_1.InvitationBatchStatus.EXECUTION_STARTED,
        allowedOperations: ['start_execution'],
        errorMessage: '报名已结束状态下只能执行开始执行操作'
    },
    {
        entityType: 'batch',
        fromStatus: types_1.InvitationBatchStatus.EXECUTION_STARTED,
        toStatus: types_1.InvitationBatchStatus.EXECUTION_COMPLETED,
        allowedOperations: ['complete_execution'],
        errorMessage: '执行中状态下只能执行完成执行操作'
    },
    {
        entityType: 'batch',
        fromStatus: types_1.InvitationBatchStatus.EXECUTION_COMPLETED,
        toStatus: types_1.InvitationBatchStatus.SETTLEMENT_STARTED,
        allowedOperations: ['start_settlement'],
        errorMessage: '执行已完成状态下只能执行开始结算操作'
    },
    {
        entityType: 'batch',
        fromStatus: types_1.InvitationBatchStatus.SETTLEMENT_STARTED,
        toStatus: types_1.InvitationBatchStatus.SETTLEMENT_COMPLETED,
        allowedOperations: ['complete_settlement'],
        errorMessage: '结算中状态下只能执行完成结算操作'
    }
];
exports.ENROLLMENT_STATUS_TRANSITIONS = [
    {
        entityType: 'enrollment',
        fromStatus: types_1.EnrollmentStatus.PENDING_REVIEW,
        toStatus: types_1.EnrollmentStatus.APPROVED,
        allowedOperations: ['approve'],
        errorMessage: '待审核状态下只能执行通过操作'
    },
    {
        entityType: 'enrollment',
        fromStatus: types_1.EnrollmentStatus.PENDING_REVIEW,
        toStatus: types_1.EnrollmentStatus.REJECTED,
        allowedOperations: ['reject'],
        errorMessage: '待审核状态下只能执行拒绝操作'
    },
    {
        entityType: 'enrollment',
        fromStatus: types_1.EnrollmentStatus.PENDING_REVIEW,
        toStatus: types_1.EnrollmentStatus.CANCELLED,
        allowedOperations: ['cancel'],
        errorMessage: '待审核状态下只能执行取消操作'
    },
    {
        entityType: 'enrollment',
        fromStatus: types_1.EnrollmentStatus.APPROVED,
        toStatus: types_1.EnrollmentStatus.CANCELLED,
        allowedOperations: ['cancel'],
        errorMessage: '已通过状态下只能执行取消操作'
    }
];
function validateStateTransition(entityType, fromStatus, toStatus, operation) {
    const transitions = entityType === 'batch' ? exports.BATCH_STATUS_TRANSITIONS : exports.ENROLLMENT_STATUS_TRANSITIONS;
    const rule = transitions.find(t => t.entityType === entityType && t.fromStatus === fromStatus && t.toStatus === toStatus);
    if (!rule) {
        return {
            success: false,
            error: {
                code: 'INVALID_STATE_TRANSITION',
                message: `不允许从状态「${fromStatus}」流转到「${toStatus}」`,
                details: {
                    entityType,
                    fromStatus,
                    toStatus,
                    operation
                }
            }
        };
    }
    if (!rule.allowedOperations.includes(operation)) {
        return {
            success: false,
            error: {
                code: 'INVALID_OPERATION',
                message: `状态「${fromStatus}」下不允许执行「${operation}」操作`,
                details: {
                    entityType,
                    fromStatus,
                    toStatus,
                    operation,
                    allowedOperations: rule.allowedOperations
                }
            }
        };
    }
    return { success: true };
}
function createEventRecord(entityType, eventType, context, fromStatus, toStatus, additionalPayload = {}) {
    return {
        id: (0, uuid_1.v4)(),
        batchId: entityType === 'batch' ? context.entityId : undefined,
        enrollmentId: entityType !== 'batch' ? context.entityId : undefined,
        entityType,
        eventType,
        fromStatus,
        toStatus,
        payload: {
            operation: eventType,
            operator: context.operator,
            notes: context.notes,
            ...context.additionalData,
            ...additionalPayload
        },
        timestamp: new Date(),
        operator: context.operator,
        notes: context.notes
    };
}
function getAvailableOperations(entityType, currentStatus) {
    const transitions = entityType === 'batch' ? exports.BATCH_STATUS_TRANSITIONS : exports.ENROLLMENT_STATUS_TRANSITIONS;
    const operations = new Set();
    transitions
        .filter(t => t.entityType === entityType && t.fromStatus === currentStatus)
        .forEach(t => t.allowedOperations.forEach(op => operations.add(op)));
    return Array.from(operations);
}
function canPerformOperation(entityType, currentStatus, operation) {
    const transitions = entityType === 'batch' ? exports.BATCH_STATUS_TRANSITIONS : exports.ENROLLMENT_STATUS_TRANSITIONS;
    return transitions.some(t => t.entityType === entityType && t.fromStatus === currentStatus && t.allowedOperations.includes(operation));
}
//# sourceMappingURL=stateMachine.js.map