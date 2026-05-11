"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimisticLockError = exports.ConflictError = exports.NotFoundError = exports.ValidationError = exports.AppError = void 0;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const uuid_1 = require("uuid");
class AppError extends Error {
    constructor(message, options = {}) {
        super(message);
        this.name = 'AppError';
        this.code = options.code || 'INTERNAL_ERROR';
        this.statusCode = options.statusCode || 500;
        this.details = options.details;
        this.requestId = options.requestId || (0, uuid_1.v4)();
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, details, requestId) {
        super(message, {
            code: 'VALIDATION_ERROR',
            statusCode: 400,
            details,
            requestId
        });
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(message, details, requestId) {
        super(message, {
            code: 'NOT_FOUND',
            statusCode: 404,
            details,
            requestId
        });
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message, details, requestId) {
        super(message, {
            code: 'CONFLICT',
            statusCode: 409,
            details,
            requestId
        });
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class OptimisticLockError extends AppError {
    constructor(message, details, requestId) {
        super(message, {
            code: 'OPTIMISTIC_LOCK_ERROR',
            statusCode: 409,
            details,
            requestId
        });
        this.name = 'OptimisticLockError';
    }
}
exports.OptimisticLockError = OptimisticLockError;
function errorHandler(err, req, res, _next) {
    const requestId = req.idempotency?.requestId || (0, uuid_1.v4)();
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details
            },
            requestId: err.requestId || requestId,
            timestamp: new Date().toISOString()
        });
        return;
    }
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: '服务器内部错误'
        },
        requestId,
        timestamp: new Date().toISOString()
    });
}
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `路由 ${req.method} ${req.path} 不存在`
        },
        requestId: req.idempotency?.requestId || (0, uuid_1.v4)(),
        timestamp: new Date().toISOString()
    });
}
//# sourceMappingURL=error.js.map