"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStateManager = exports.StateManager = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../models/types");
const database_1 = require("./database");
class StateManager {
    constructor(operator) {
        this.operator = operator;
    }
    getCurrentOperator() {
        return { ...this.operator };
    }
    hasPermission(required) {
        const hierarchy = [
            types_1.PermissionLevel.VIEWER,
            types_1.PermissionLevel.OPERATOR,
            types_1.PermissionLevel.MANAGER,
            types_1.PermissionLevel.ADMIN
        ];
        const currentLevel = hierarchy.indexOf(this.operator.permission);
        const requiredLevel = hierarchy.indexOf(required);
        return currentLevel >= requiredLevel;
    }
    ensurePermission(required) {
        if (!this.hasPermission(required)) {
            throw new Error(`权限不足: 需要 ${required} 权限, 当前权限为 ${this.operator.permission}`);
        }
    }
    async transitionState(recordId, fromStatus, toStatus, reason, metadata) {
        this.ensurePermission(types_1.PermissionLevel.OPERATOR);
        const change = {
            id: (0, uuid_1.v4)(),
            recordId,
            fromStatus,
            toStatus,
            operator: this.operator,
            reason,
            timestamp: Date.now(),
            metadata
        };
        await database_1.dbService.insertStateChange(change);
        await database_1.dbService.updateRecordStatus(recordId, toStatus);
        await this.logAudit('state_transition', 'record', recordId, {
            fromStatus,
            toStatus,
            reason
        });
        return change;
    }
    async transitionRecord(record, toStatus, reason, metadata) {
        const change = await this.transitionState(record.id, record.status, toStatus, reason, metadata);
        record.status = toStatus;
        record.stateChanges.push(change);
        record.updatedAt = Date.now();
        return record;
    }
    async logAudit(action, resourceType, resourceId, details = {}) {
        const log = {
            id: (0, uuid_1.v4)(),
            action,
            operatorId: this.operator.id,
            operatorName: this.operator.name,
            timestamp: Date.now(),
            resourceType,
            resourceId,
            details
        };
        await database_1.dbService.insertAuditLog(log);
    }
    async logAction(action, resourceType, resourceId, details = {}) {
        await this.logAudit(action, resourceType, resourceId, details);
    }
}
exports.StateManager = StateManager;
const createStateManager = async (operatorId = 'default-admin') => {
    const operator = await database_1.dbService.getOperatorById(operatorId);
    if (!operator) {
        throw new Error(`操作员不存在: ${operatorId}`);
    }
    return new StateManager(operator);
};
exports.createStateManager = createStateManager;
