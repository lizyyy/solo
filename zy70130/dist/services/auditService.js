"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = exports.AuditService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
class AuditService {
    logAudit(action, actorId, actorType, targetType, targetId, beforeState, afterState, requestId) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const auditLog = {
            id: (0, uuid_1.v4)(),
            action,
            actorId,
            actorType,
            targetType,
            targetId,
            beforeState,
            afterState,
            timestamp: now,
            requestId,
        };
        const targetKey = (0, database_1.getAuditLogsByTargetKey)(targetType, targetId);
        const existingLogs = db.auditLogs.get(targetKey) || [];
        existingLogs.push(auditLog);
        db.auditLogs.set(targetKey, existingLogs);
        return auditLog;
    }
    getAuditLogsByTarget(targetType, targetId) {
        const db = (0, database_1.getDatabase)();
        const targetKey = (0, database_1.getAuditLogsByTargetKey)(targetType, targetId);
        const logs = db.auditLogs.get(targetKey) || [];
        return [...logs].sort((a, b) => b.timestamp - a.timestamp);
    }
    getAuditLogsByActor(actorId) {
        const db = (0, database_1.getDatabase)();
        const allLogs = [];
        for (const logs of db.auditLogs.values()) {
            allLogs.push(...logs.filter((log) => log.actorId === actorId));
        }
        return allLogs.sort((a, b) => b.timestamp - a.timestamp);
    }
    getAuditLogsByAction(action) {
        const db = (0, database_1.getDatabase)();
        const allLogs = [];
        for (const logs of db.auditLogs.values()) {
            allLogs.push(...logs.filter((log) => log.action === action));
        }
        return allLogs.sort((a, b) => b.timestamp - a.timestamp);
    }
    freezeTarget(targetType, targetId, reason, operatorId) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const requestId = (0, uuid_1.v4)();
        const freezeKey = (0, database_1.getFreezeKey)(targetType, targetId);
        const activeFreeze = db.freezeRecords.get(freezeKey);
        if (activeFreeze && activeFreeze.isActive) {
            throw new Error('目标已被冻结');
        }
        const freezeRecord = {
            id: (0, uuid_1.v4)(),
            targetType,
            targetId,
            reason,
            operatorId,
            isActive: true,
            createdAt: now,
            releasedAt: null,
        };
        db.freezeRecords.set(freezeKey, freezeRecord);
        this.logAudit('freeze', operatorId, 'admin', targetType, targetId, JSON.stringify({ isFrozen: false }), JSON.stringify({ isFrozen: true, reason }), requestId);
        return freezeRecord;
    }
    unfreezeTarget(targetType, targetId, operatorId) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const requestId = (0, uuid_1.v4)();
        const freezeKey = (0, database_1.getFreezeKey)(targetType, targetId);
        const freezeRecord = db.freezeRecords.get(freezeKey);
        if (!freezeRecord || !freezeRecord.isActive) {
            throw new Error('目标未被冻结');
        }
        const updated = {
            ...freezeRecord,
            isActive: false,
            releasedAt: now,
        };
        db.freezeRecords.set(freezeKey, updated);
        this.logAudit('unfreeze', operatorId, 'admin', targetType, targetId, JSON.stringify({ isFrozen: true }), JSON.stringify({ isFrozen: false }), requestId);
        return updated;
    }
    isTargetFrozen(targetType, targetId) {
        const db = (0, database_1.getDatabase)();
        const freezeKey = (0, database_1.getFreezeKey)(targetType, targetId);
        const freezeRecord = db.freezeRecords.get(freezeKey);
        return !!(freezeRecord && freezeRecord.isActive);
    }
    getActiveFreeze(targetType, targetId) {
        const db = (0, database_1.getDatabase)();
        const freezeKey = (0, database_1.getFreezeKey)(targetType, targetId);
        const freezeRecord = db.freezeRecords.get(freezeKey);
        if (!freezeRecord || !freezeRecord.isActive) {
            return null;
        }
        return freezeRecord;
    }
    getFreezeHistory(targetType, targetId) {
        const db = (0, database_1.getDatabase)();
        const history = [];
        for (const record of db.freezeRecords.values()) {
            if (record.targetType === targetType && record.targetId === targetId) {
                history.push(record);
            }
        }
        return history.sort((a, b) => b.createdAt - a.createdAt);
    }
}
exports.AuditService = AuditService;
exports.auditService = new AuditService();
//# sourceMappingURL=auditService.js.map