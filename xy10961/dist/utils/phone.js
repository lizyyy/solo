"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.isValidPhone = isValidPhone;
function normalizePhone(phone) {
    if (phone === null || phone === undefined) {
        return '';
    }
    let phoneStr = String(phone).trim();
    phoneStr = phoneStr.replace(/[\s\-\(\)\.\+]/g, '');
    if (phoneStr.startsWith('86') && phoneStr.length === 13) {
        phoneStr = phoneStr.slice(2);
    }
    if (phoneStr.startsWith('+86')) {
        phoneStr = phoneStr.slice(3);
    }
    if (/^1[3-9]\d{9}$/.test(phoneStr)) {
        return phoneStr;
    }
    return phoneStr;
}
function isValidPhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
}
