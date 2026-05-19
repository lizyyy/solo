"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityManager = void 0;
exports.createSecurityManager = createSecurityManager;
const config_1 = require("./config");
class SecurityManager {
    constructor(user) {
        this.currentUser = user;
    }
    hasPermission(permission) {
        return this.currentUser.permissions.includes(permission) ||
            this.currentUser.permissions.includes('admin');
    }
    checkPermission(permission) {
        if (!this.hasPermission(permission)) {
            throw new Error(`权限不足: 需要 ${permission} 权限`);
        }
    }
    shouldMaskField(fieldName) {
        for (const config of config_1.SENSITIVE_FIELDS) {
            if (config.fields.includes(fieldName)) {
                return !config.roles.includes(this.currentUser.role);
            }
        }
        return false;
    }
    maskValue(value, fieldName) {
        if (value === undefined || value === null)
            return value;
        for (const config of config_1.SENSITIVE_FIELDS) {
            if (config.fields.includes(fieldName)) {
                if (typeof value === 'string') {
                    if (fieldName === 'contactPhone') {
                        return value.substring(0, 3) + config.maskPattern + value.substring(value.length - 2);
                    }
                    return config.maskPattern;
                }
                if (typeof value === 'number') {
                    return config.maskPattern;
                }
            }
        }
        return value;
    }
    maskSensitiveData(obj) {
        if (!obj || typeof obj !== 'object')
            return obj;
        const result = { ...obj };
        for (const key in result) {
            if (this.shouldMaskField(key)) {
                result[key] = this.maskValue(result[key], key);
            }
            else if (Array.isArray(result[key])) {
                result[key] = result[key].map((item) => typeof item === 'object' ? this.maskSensitiveData(item) : item);
            }
            else if (typeof result[key] === 'object' && result[key] !== null) {
                result[key] = this.maskSensitiveData(result[key]);
            }
        }
        return result;
    }
    maskBooth(booth) {
        return this.maskSensitiveData(booth);
    }
    maskEquipment(equipment) {
        return this.maskSensitiveData(equipment);
    }
    maskRentalRecord(record) {
        return this.maskSensitiveData(record);
    }
    maskAuditLog(log) {
        const maskedLog = { ...log };
        for (const change of maskedLog.changes) {
            if (this.shouldMaskField(change.field)) {
                change.oldValue = this.maskValue(change.oldValue, change.field);
                change.newValue = this.maskValue(change.newValue, change.field);
            }
        }
        return maskedLog;
    }
    logAuditLogList(logs) {
        return logs.map(log => this.maskAuditLog(log));
    }
    maskBoothList(booths) {
        return booths.map(booth => this.maskBooth(booth));
    }
    maskEquipmentList(equipment) {
        return equipment.map(eq => this.maskEquipment(eq));
    }
    maskRentalRecordList(records) {
        return records.map(record => this.maskRentalRecord(record));
    }
    getCurrentUser() {
        return { ...this.currentUser };
    }
    canViewSensitiveFields() {
        for (const config of config_1.SENSITIVE_FIELDS) {
            if (!config.roles.includes(this.currentUser.role)) {
                return true;
            }
        }
        return false;
    }
}
exports.SecurityManager = SecurityManager;
function createSecurityManager(user) {
    return new SecurityManager(user);
}
