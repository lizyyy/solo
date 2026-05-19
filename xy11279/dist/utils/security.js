"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskPhone = maskPhone;
exports.maskEmployeeId = maskEmployeeId;
exports.maskSensitiveData = maskSensitiveData;
exports.sanitizeLog = sanitizeLog;
function maskPhone(phone) {
    if (!phone || phone.length < 7)
        return '***';
    return phone.slice(0, 3) + '****' + phone.slice(-4);
}
function maskEmployeeId(employeeId) {
    if (!employeeId || employeeId.length < 4)
        return '***';
    return employeeId.slice(0, 2) + '**' + employeeId.slice(-2);
}
function maskSensitiveData(data) {
    const masked = { ...data };
    if (masked.phone && typeof masked.phone === 'string') {
        masked.phone = maskPhone(masked.phone);
    }
    if (masked.employeeId && typeof masked.employeeId === 'string') {
        masked.employeeId = maskEmployeeId(masked.employeeId);
    }
    if ('_sensitive' in masked) {
        delete masked._sensitive;
    }
    if (masked.operatorPhone && typeof masked.operatorPhone === 'string') {
        masked.operatorPhone = maskPhone(masked.operatorPhone);
    }
    return masked;
}
function sanitizeLog(data) {
    const str = JSON.stringify(data);
    return str.replace(/\d{11}/g, (match) => maskPhone(match));
}
