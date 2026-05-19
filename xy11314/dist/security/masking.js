"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.maskPhoneNumber = maskPhoneNumber;
exports.maskName = maskName;
exports.maskCoordinates = maskCoordinates;
exports.shouldMaskSensitiveData = shouldMaskSensitiveData;
exports.maskComplaint = maskComplaint;
exports.maskAdjudication = maskAdjudication;
exports.maskAuditLogDetails = maskAuditLogDetails;
exports.maskBadRecord = maskBadRecord;
const DEFAULT_CONFIG = {
    enabled: true,
    maskPhone: true,
    maskName: true,
    maskLocation: false,
    allowedRolesForFullAccess: ['admin', 'auditor']
};
exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
function maskPhoneNumber(phone) {
    if (!phone || phone.length < 7)
        return '***';
    return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
}
function maskName(name) {
    if (!name || name.length === 0)
        return '***';
    if (name.length === 1)
        return name + '*';
    if (name.length === 2)
        return name.substring(0, 1) + '*';
    return name.substring(0, 1) + '*'.repeat(name.length - 2) + name.substring(name.length - 1);
}
function maskCoordinates(lat, lng) {
    return {
        latitude: Math.round(lat * 100) / 100,
        longitude: Math.round(lng * 100) / 100
    };
}
function shouldMaskSensitiveData(userRole, config = DEFAULT_CONFIG) {
    if (!config.enabled)
        return false;
    return !config.allowedRolesForFullAccess.includes(userRole);
}
function maskComplaint(complaint, userRole, config = DEFAULT_CONFIG) {
    if (!shouldMaskSensitiveData(userRole, config)) {
        return complaint;
    }
    const masked = { ...complaint };
    if (config.maskPhone) {
        masked.parentPhone = maskPhoneNumber(complaint.parentPhone);
    }
    if (config.maskName) {
        masked.parentName = maskName(complaint.parentName);
        masked.studentName = maskName(complaint.studentName);
    }
    return masked;
}
function maskAdjudication(adjudication, userRole, config = DEFAULT_CONFIG) {
    if (!shouldMaskSensitiveData(userRole, config)) {
        return adjudication;
    }
    return {
        ...adjudication,
        evidence: {
            ...adjudication.evidence
        }
    };
}
function maskAuditLogDetails(details, userRole) {
    try {
        const parsed = JSON.parse(details);
        if (parsed.parentPhone) {
            parsed.parentPhone = maskPhoneNumber(parsed.parentPhone);
        }
        if (parsed.parentName) {
            parsed.parentName = maskName(parsed.parentName);
        }
        if (parsed.studentName) {
            parsed.studentName = maskName(parsed.studentName);
        }
        return JSON.stringify(parsed);
    }
    catch {
        return details;
    }
}
function maskBadRecord(badRecord, userRole) {
    if (!shouldMaskSensitiveData(userRole, DEFAULT_CONFIG)) {
        return badRecord;
    }
    try {
        const rawData = JSON.parse(badRecord.rawData);
        if (rawData.parentPhone) {
            rawData.parentPhone = maskPhoneNumber(rawData.parentPhone);
        }
        if (rawData.parentName) {
            rawData.parentName = maskName(rawData.parentName);
        }
        if (rawData.studentName) {
            rawData.studentName = maskName(rawData.studentName);
        }
        return {
            ...badRecord,
            rawData: JSON.stringify(rawData)
        };
    }
    catch {
        return badRecord;
    }
}
