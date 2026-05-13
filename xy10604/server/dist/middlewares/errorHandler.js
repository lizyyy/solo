"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = exports.AppError = void 0;
const client_1 = require("@prisma/client");
class AppError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    console.error('错误:', err);
    let statusCode = err.statusCode || 500;
    let message = err.message || '服务器内部错误';
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002':
                statusCode = 409;
                message = '数据已存在，唯一约束冲突';
                break;
            case 'P2025':
                statusCode = 404;
                message = '记录不存在';
                break;
            default:
                statusCode = 400;
                message = '数据库操作失败';
        }
    }
    if (err.name === 'ZodError') {
        statusCode = 400;
        message = err.errors?.[0]?.message || '参数验证失败';
    }
    res.status(statusCode).json({
        error: err.isOperational ? message : '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
exports.errorHandler = errorHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map