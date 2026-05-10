"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyConflictError = exports.InspectionRequiredError = exports.ValidationError = exports.BatchNotFoundError = exports.DuplicateSubmissionError = exports.InvalidStateTransitionError = exports.BusinessError = void 0;
class BusinessError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'BusinessError';
    }
}
exports.BusinessError = BusinessError;
class InvalidStateTransitionError extends BusinessError {
    constructor(fromStatus, toStatus, allowedTransitions) {
        super(`状态流转非法: 不能从 "${fromStatus}" 流转到 "${toStatus}"。允许的目标状态: [${allowedTransitions.join(', ')}]`, 'INVALID_STATE_TRANSITION', { fromStatus, toStatus, allowedTransitions });
        this.allowedTransitions = allowedTransitions;
        this.name = 'InvalidStateTransitionError';
    }
}
exports.InvalidStateTransitionError = InvalidStateTransitionError;
class DuplicateSubmissionError extends BusinessError {
    constructor(operationType, batchId) {
        super(`重复提交错误: 批次 "${batchId}" 的 ${operationType} 已完成，不可重复操作`, 'DUPLICATE_SUBMISSION', { operationType, batchId });
        this.operationType = operationType;
        this.batchId = batchId;
        this.name = 'DuplicateSubmissionError';
    }
}
exports.DuplicateSubmissionError = DuplicateSubmissionError;
class BatchNotFoundError extends BusinessError {
    constructor(batchId) {
        super(`批次不存在: 未找到编号为 "${batchId}" 的批次`, 'BATCH_NOT_FOUND', { batchId });
        this.batchId = batchId;
        this.name = 'BatchNotFoundError';
    }
}
exports.BatchNotFoundError = BatchNotFoundError;
class ValidationError extends BusinessError {
    constructor(message, field, details) {
        super(message, 'VALIDATION_ERROR', { field, ...details });
        this.field = field;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class InspectionRequiredError extends BusinessError {
    constructor(missingInspections) {
        super(`缺少必要的验收项: [${missingInspections.join(', ')}]`, 'INSPECTION_REQUIRED', { missingInspections });
        this.missingInspections = missingInspections;
        this.name = 'InspectionRequiredError';
    }
}
exports.InspectionRequiredError = InspectionRequiredError;
class ConcurrencyConflictError extends BusinessError {
    constructor(batchId, expectedVersion, actualVersion) {
        super(`并发冲突: 批次 "${batchId}" 已被其他操作更新，请刷新后重试`, 'CONCURRENCY_CONFLICT', { expectedVersion, actualVersion });
        this.batchId = batchId;
        this.expectedVersion = expectedVersion;
        this.actualVersion = actualVersion;
        this.name = 'ConcurrencyConflictError';
    }
}
exports.ConcurrencyConflictError = ConcurrencyConflictError;
//# sourceMappingURL=errors.js.map