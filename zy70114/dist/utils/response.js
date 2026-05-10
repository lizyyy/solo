"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = exports.formatTime = exports.formatDuration = exports.errorResponse = exports.successResponse = exports.BusinessError = void 0;
const database_1 = require("../database");
class BusinessError extends Error {
    constructor(message, businessMessage, code = 'BUSINESS_ERROR') {
        super(message);
        this.code = code;
        this.businessMessage = businessMessage;
        this.name = 'BusinessError';
    }
}
exports.BusinessError = BusinessError;
const successResponse = (data, message = '操作成功', businessMessage) => ({
    success: true,
    code: 'SUCCESS',
    message,
    business_message: businessMessage,
    data,
    timestamp: (0, database_1.now)(),
});
exports.successResponse = successResponse;
const errorResponse = (code, message, businessMessage, data) => ({
    success: false,
    code,
    message,
    business_message: businessMessage,
    data,
    timestamp: (0, database_1.now)(),
});
exports.errorResponse = errorResponse;
const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0) {
        return `${minutes}分${seconds}秒`;
    }
    return `${seconds}秒`;
};
exports.formatDuration = formatDuration;
const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};
exports.formatTime = formatTime;
const formatCurrency = (amount, currency = 'CNY') => {
    const symbols = {
        CNY: '¥',
        USD: '$',
        EUR: '€',
    };
    return `${symbols[currency] || ''}${amount.toFixed(2)}`;
};
exports.formatCurrency = formatCurrency;
//# sourceMappingURL=response.js.map