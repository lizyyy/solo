"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonBodyParser = jsonBodyParser;
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const express_1 = __importDefault(require("express"));
const domain_1 = require("../domain");
function jsonBodyParser(req, res, next) {
    express_1.default.json()(req, res, next);
}
function errorHandler(err, req, res, next) {
    console.error('API Error:', err);
    if (err instanceof domain_1.BusinessError) {
        res.status(400).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details
            }
        });
        return;
    }
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: '服务器内部错误'
        }
    });
}
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: '请求的资源不存在'
        }
    });
}
//# sourceMappingURL=middleware.js.map