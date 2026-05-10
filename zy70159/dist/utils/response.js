"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
function successResponse(data, message = '操作成功') {
    return {
        success: true,
        code: 'SUCCESS',
        message,
        data,
    };
}
function errorResponse(code, message, data) {
    return {
        success: false,
        code,
        message,
        data,
    };
}
