"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const certificateService_1 = require("../services/certificateService");
function errorHandler(err, req, res, next) {
    console.error('Error:', err);
    if (err instanceof certificateService_1.CertificateError) {
        res.status(400).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
                suggestion: err.suggestion,
            },
        });
        return;
    }
    res.status(500).json({
        error: {
            code: 'INTERNAL_ERROR',
            message: '服务器内部错误',
            suggestion: 'retry',
        },
    });
}
