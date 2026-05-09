"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.normalizePlate = normalizePlate;
exports.dateToString = dateToString;
exports.stringToDate = stringToDate;
exports.formatCurrency = formatCurrency;
exports.formatDateTime = formatDateTime;
exports.calculateDurationMinutes = calculateDurationMinutes;
exports.formatDuration = formatDuration;
exports.translateStatus = translateStatus;
exports.translatePaymentChannel = translatePaymentChannel;
exports.translateActionType = translateActionType;
const uuid_1 = require("uuid");
function generateId() {
    return (0, uuid_1.v4)();
}
function normalizePlate(plate) {
    return plate.toUpperCase().replace(/[^A-Z0-9\u4e00-\u9fa5]/g, '');
}
function dateToString(date) {
    return date.toISOString();
}
function stringToDate(str) {
    return new Date(str);
}
function formatCurrency(amount) {
    return `¥${amount.toFixed(2)}`;
}
function formatDateTime(date) {
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
function calculateDurationMinutes(entry, exit) {
    return Math.max(0, Math.round((exit.getTime() - entry.getTime()) / 60000));
}
function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
}
function translateStatus(status) {
    const translations = {
        pending: '待处理',
        merging: '合并中',
        merged: '已合并',
        collecting: '追缴中',
        paid: '已结清',
        partially_paid: '部分结清',
        blacklisted: '已拉黑',
        withdrawn: '已撤回'
    };
    return translations[status] || status;
}
function translatePaymentChannel(channel) {
    const translations = {
        wechat: '微信支付',
        alipay: '支付宝',
        bank: '银行转账',
        cash: '现金',
        third_party: '第三方'
    };
    return translations[channel] || channel;
}
function translateActionType(type) {
    const translations = {
        notify: '首次通知',
        reminder: '再次提醒',
        legal_notice: '法务告知',
        blacklist: '加入黑名单',
        withdraw: '撤回操作'
    };
    return translations[type] || type;
}
//# sourceMappingURL=utils.js.map