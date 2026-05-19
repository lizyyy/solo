"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
function errorHandler(err, req, res, next) {
    console.error('Error:', err);
    const statusCode = 'statusCode' in err ? err.statusCode : 500;
    const message = err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        error: err.constructor.name,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}
