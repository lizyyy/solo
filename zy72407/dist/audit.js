"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
exports.addManualEdit = addManualEdit;
exports.updateRecordStatus = updateRecordStatus;
exports.confirmRecord = confirmRecord;
exports.confirmTempSubstitute = confirmTempSubstitute;
exports.settleRecords = settleRecords;
exports.getRecordAuditTrail = getRecordAuditTrail;
const uuid_1 = require("uuid");
const types_1 = require("./types");
function createAuditLog(operator, action, fieldName, oldValue, newValue, reason) {
    return {
        id: (0, uuid_1.v4)(),
        timestamp: new Date().toISOString(),
        operator,
        action,
        fieldName,
        oldValue,
        newValue,
        reason
    };
}
function addManualEdit(record, operator, fieldName, oldValue, newValue, reason) {
    const auditLog = createAuditLog(operator, 'manual_edit', fieldName, oldValue, newValue, reason);
    return {
        ...record,
        manualEdits: [...record.manualEdits, auditLog],
        reviewFlag: types_1.ReviewFlag.MANUAL_EDIT,
        updatedAt: new Date().toISOString()
    };
}
function updateRecordStatus(record, newStatus, operator, reason) {
    const oldStatus = record.status;
    if (oldStatus === types_1.RecordStatus.NEEDS_REVIEW &&
        newStatus === types_1.RecordStatus.CONFIRMED &&
        record.reviewFlag === types_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP) {
        const auditLog = createAuditLog(operator, 'status_change', 'reviewFlag', record.reviewFlag, types_1.ReviewFlag.NONE, reason || '票务同事复核通过');
        return {
            ...record,
            status: newStatus,
            reviewFlag: types_1.ReviewFlag.NONE,
            manualEdits: [...record.manualEdits, auditLog],
            updatedAt: new Date().toISOString()
        };
    }
    const auditLog = createAuditLog(operator, 'status_change', 'status', oldStatus, newStatus, reason);
    return {
        ...record,
        status: newStatus,
        manualEdits: [...record.manualEdits, auditLog],
        updatedAt: new Date().toISOString()
    };
}
function confirmRecord(record, operator, confirm, reason) {
    if (record.status !== types_1.RecordStatus.NEEDS_REVIEW) {
        return record;
    }
    if (confirm) {
        const auditLog = createAuditLog(operator, 'review_confirm', 'status', record.status, types_1.RecordStatus.CONFIRMED, reason || '票务同事复核通过');
        const reviewFlagLog = record.reviewFlag !== types_1.ReviewFlag.NONE
            ? [createAuditLog(operator, 'review_flag_cleared', 'reviewFlag', record.reviewFlag, types_1.ReviewFlag.NONE, reason || '复核后清除标记')]
            : [];
        return {
            ...record,
            status: types_1.RecordStatus.CONFIRMED,
            reviewFlag: types_1.ReviewFlag.NONE,
            manualEdits: [...record.manualEdits, auditLog, ...reviewFlagLog],
            updatedAt: new Date().toISOString()
        };
    }
    else {
        const auditLog = createAuditLog(operator, 'review_reject', undefined, undefined, undefined, reason || '复核不予通过');
        return {
            ...record,
            status: types_1.RecordStatus.ERROR,
            manualEdits: [...record.manualEdits, auditLog],
            updatedAt: new Date().toISOString()
        };
    }
}
function confirmTempSubstitute(record, operator, confirm, reason) {
    if (record.reviewFlag !== types_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP) {
        return record;
    }
    if (confirm) {
        return updateRecordStatus(record, types_1.RecordStatus.CONFIRMED, operator, reason || '临时替补复核通过');
    }
    else {
        const auditLog = createAuditLog(operator, 'reject_temp_substitute', undefined, undefined, undefined, reason || '临时替补不予确认');
        return {
            ...record,
            status: types_1.RecordStatus.ERROR,
            manualEdits: [...record.manualEdits, auditLog],
            updatedAt: new Date().toISOString()
        };
    }
}
function settleRecords(records, operator) {
    const now = new Date().toISOString();
    return records.map(record => {
        if (record.status !== types_1.RecordStatus.CONFIRMED) {
            return record;
        }
        const auditLog = createAuditLog(operator, 'settle', 'status', record.status, types_1.RecordStatus.SETTLED, '分账明细更新');
        return {
            ...record,
            status: types_1.RecordStatus.SETTLED,
            settledAt: now,
            manualEdits: [...record.manualEdits, auditLog],
            updatedAt: now
        };
    });
}
function getRecordAuditTrail(record) {
    const trail = [];
    trail.push({
        timestamp: record.createdAt,
        action: 'created',
        details: '记录创建'
    });
    if (record.matchedAt) {
        trail.push({
            timestamp: record.matchedAt,
            action: 'matched',
            details: `自动匹配 ${record.matchedBy === 'auto' ? '系统' : '人工'}完成`
        });
    }
    record.manualEdits.forEach(edit => {
        trail.push({
            timestamp: edit.timestamp,
            action: edit.action,
            operator: edit.operator,
            field: edit.fieldName,
            oldValue: edit.oldValue,
            newValue: edit.newValue,
            reason: edit.reason
        });
    });
    if (record.settledAt) {
        trail.push({
            timestamp: record.settledAt,
            action: 'settled',
            details: '分账完成'
        });
    }
    return trail.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
//# sourceMappingURL=audit.js.map