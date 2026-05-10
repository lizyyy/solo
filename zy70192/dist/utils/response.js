"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorCodes = exports.AppError = exports.errorResponse = exports.successResponse = void 0;
const successResponse = (data, message = '操作成功') => ({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
});
exports.successResponse = successResponse;
const errorResponse = (message, errorCode) => ({
    success: false,
    message,
    errorCode,
    timestamp: new Date().toISOString()
});
exports.errorResponse = errorResponse;
class AppError extends Error {
    constructor(message, errorCode = 'INTERNAL_ERROR', statusCode = 500) {
        super(message);
        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
exports.errorCodes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    FORBIDDEN: 'FORBIDDEN',
    BAD_REQUEST: 'BAD_REQUEST',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    IDEMPOTENT_CONFLICT: 'IDEMPOTENT_CONFLICT',
    SAMPLE_FROZEN: 'SAMPLE_FROZEN',
    INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
    TASK_NOT_FOUND: 'TASK_NOT_FOUND',
    DUPLICATE_OPERATION: 'DUPLICATE_OPERATION'
};
