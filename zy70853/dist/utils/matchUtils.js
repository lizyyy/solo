"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateStringSimilarity = calculateStringSimilarity;
exports.isSameNameItem = isSameNameItem;
exports.isOverdue = isOverdue;
exports.getOverdueDays = getOverdueDays;
exports.hideSensitiveInfo = hideSensitiveInfo;
exports.generateMatchId = generateMatchId;
exports.generateBatchId = generateBatchId;
const moment_1 = __importDefault(require("moment"));
function calculateStringSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2)
        return 100;
    if (!s1 || !s2)
        return 0;
    const set1 = new Set(s1.split(/\s+/));
    const set2 = new Set(s2.split(/\s+/));
    let matches = 0;
    for (const word of set1) {
        if (set2.has(word))
            matches++;
    }
    const union = new Set([...set1, ...set2]).size;
    return union > 0 ? Math.round((matches / union) * 100) : 0;
}
function isSameNameItem(name1, name2) {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    const synonyms = {
        '手机': ['iphone', '华为', '小米', 'oppo', 'vivo', '电话', '智能机'],
        '钱包': ['皮夹', '钱夹', '手包'],
        '身份证': ['id卡', '身份卡'],
        '钥匙': ['锁匙', '钥匙串'],
        '雨伞': ['伞', '遮阳伞']
    };
    if (n1 === n2)
        return true;
    for (const [key, values] of Object.entries(synonyms)) {
        const hasKey1 = n1.includes(key) || values.some(v => n1.includes(v));
        const hasKey2 = n2.includes(key) || values.some(v => n2.includes(v));
        if (hasKey1 && hasKey2)
            return true;
    }
    return false;
}
function isOverdue(dateStr, days = 90) {
    const date = (0, moment_1.default)(dateStr, ['YYYY-MM-DD', 'YYYY/MM/DD', 'MM-DD-YYYY']);
    return date.isValid() && (0, moment_1.default)().diff(date, 'days') > days;
}
function getOverdueDays(dateStr) {
    const date = (0, moment_1.default)(dateStr, ['YYYY-MM-DD', 'YYYY/MM/DD', 'MM-DD-YYYY']);
    return date.isValid() ? (0, moment_1.default)().diff(date, 'days') : 0;
}
function hideSensitiveInfo(data) {
    const result = { ...data };
    const phoneFields = ['phone', 'telephone', 'mobile', '电话', '手机'];
    for (const field of Object.keys(result)) {
        const lowerField = field.toLowerCase();
        if (phoneFields.some(p => lowerField.includes(p))) {
            const value = String(result[field]);
            if (value.length >= 7) {
                result[field] = value.slice(0, 3) + '****' + value.slice(-4);
            }
        }
    }
    const idFields = ['idcard', 'id_card', '身份证', '证件号'];
    for (const field of Object.keys(result)) {
        const lowerField = field.toLowerCase();
        if (idFields.some(i => lowerField.includes(i))) {
            const value = String(result[field]);
            if (value.length >= 10) {
                result[field] = value.slice(0, 4) + '**********' + value.slice(-4);
            }
        }
    }
    const nameFields = ['name', '姓名'];
    for (const field of Object.keys(result)) {
        const lowerField = field.toLowerCase();
        if (nameFields.some(n => lowerField.includes(n)) && lowerField !== 'itemname') {
            const value = String(result[field]);
            if (value.length >= 2) {
                result[field] = value.slice(0, 1) + '*'.repeat(value.length - 1);
            }
        }
    }
    return result;
}
function generateMatchId() {
    return `M${Date.now()}${Math.random().toString(36).substr(2, 6)}`;
}
function generateBatchId() {
    return `B${Date.now()}${Math.random().toString(36).substr(2, 4)}`;
}
