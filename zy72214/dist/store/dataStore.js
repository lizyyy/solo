"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../types");
const pinyinDetector_1 = require("../utils/pinyinDetector");
class DataStore {
    constructor() {
        this.confirmations = new Map();
        this.exRightsReviews = new Map();
        this.balanceChanges = new Map();
        this.historyRecords = [];
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    getNow() {
        return new Date().toISOString();
    }
    createHistoryRecord(entityId, entityType, changeType, changedBy, beforeState, afterState, diffSummary) {
        const record = {
            id: this.generateId(),
            entityId,
            entityType,
            changeType,
            changedBy,
            changedAt: this.getNow(),
            beforeState,
            afterState,
            diffSummary
        };
        this.historyRecords.push(record);
    }
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    generateUniqueKey(raw) {
        return `${raw.importBatchId}-${raw.originalRowNumber}-${raw.clientAccount}-${raw.interestAmount}`;
    }
    isDuplicate(raw) {
        const key = this.generateUniqueKey(raw);
        for (const conf of this.confirmations.values()) {
            const existingKey = `${conf.importBatchId}-${conf.originalRowNumber}-${conf.clientAccount}-${conf.interestAmount}`;
            if (existingKey === key)
                return true;
        }
        return false;
    }
    importConfirmations(rawConfirmations, importedBy) {
        const result = {
            successCount: 0,
            duplicateCount: 0,
            pinyinApproverCount: 0,
            importedIds: [],
            duplicateRowNumbers: []
        };
        for (const raw of rawConfirmations) {
            if (this.isDuplicate(raw)) {
                result.duplicateCount++;
                result.duplicateRowNumbers.push(raw.originalRowNumber);
                continue;
            }
            const normalizedApprover = (0, pinyinDetector_1.normalizeApproverName)(raw.approverName);
            const isPinyin = (0, pinyinDetector_1.isPinyinName)(normalizedApprover);
            const confirmation = {
                id: this.generateId(),
                originalRowNumber: raw.originalRowNumber,
                importBatchId: raw.importBatchId,
                importedAt: this.getNow(),
                importedBy,
                clientAccount: raw.clientAccount,
                interestAmount: raw.interestAmount,
                approverName: normalizedApprover,
                approvalDate: raw.approvalDate,
                rawContent: raw.rawContent,
                remark: '',
                status: isPinyin
                    ? types_1.ProcessingStatus.PENDING_APPROVER_VERIFICATION
                    : types_1.ProcessingStatus.IMPORTED,
                manualModifications: [],
                isPinyinApprover: isPinyin,
                currentAssignee: isPinyin ? '客户经理' : null,
                balanceUpdateId: null,
                exRightsDateReviewId: null
            };
            this.confirmations.set(confirmation.id, confirmation);
            this.createHistoryRecord(confirmation.id, 'CONFIRMATION', types_1.ChangeType.CREATE, importedBy, null, this.deepClone(confirmation), `导入托管确认页 - 行号: ${raw.originalRowNumber}, 客户: ${raw.clientAccount}`);
            result.successCount++;
            result.importedIds.push(confirmation.id);
            if (isPinyin)
                result.pinyinApproverCount++;
        }
        return result;
    }
    getConfirmation(id) {
        return this.confirmations.get(id);
    }
    getAllConfirmations() {
        return Array.from(this.confirmations.values());
    }
    getConfirmationsByStatus(status) {
        return this.getAllConfirmations().filter(c => c.status === status);
    }
    updateRemark(confirmationId, newRemark, modifiedBy, reason) {
        const confirmation = this.confirmations.get(confirmationId);
        if (!confirmation)
            return false;
        const beforeState = this.deepClone(confirmation);
        const oldRemark = confirmation.remark;
        const modification = {
            fieldName: 'remark',
            oldValue: oldRemark,
            newValue: newRemark,
            modifiedBy,
            modifiedAt: this.getNow(),
            reason
        };
        confirmation.remark = newRemark;
        confirmation.manualModifications.push(modification);
        this.createHistoryRecord(confirmationId, 'CONFIRMATION', types_1.ChangeType.UPDATE, modifiedBy, beforeState, this.deepClone(confirmation), `修改备注: "${oldRemark}" → "${newRemark}"`);
        return true;
    }
    verifyApproverName(confirmationId, verifiedName, verifiedBy) {
        const confirmation = this.confirmations.get(confirmationId);
        if (!confirmation)
            return false;
        if (confirmation.status !== types_1.ProcessingStatus.PENDING_APPROVER_VERIFICATION)
            return false;
        const beforeState = this.deepClone(confirmation);
        const oldName = confirmation.approverName;
        const modification = {
            fieldName: 'approverName',
            oldValue: oldName,
            newValue: verifiedName,
            modifiedBy: verifiedBy,
            modifiedAt: this.getNow(),
            reason: '客户经理复核审批人拼音'
        };
        confirmation.approverName = verifiedName;
        confirmation.isPinyinApprover = false;
        confirmation.status = types_1.ProcessingStatus.APPROVER_VERIFIED;
        confirmation.currentAssignee = null;
        confirmation.manualModifications.push(modification);
        this.createHistoryRecord(confirmationId, 'CONFIRMATION', types_1.ChangeType.STATUS_CHANGE, verifiedBy, beforeState, this.deepClone(confirmation), `审批人复核完成: "${oldName}" → "${verifiedName}", 状态变更为已复核`);
        return true;
    }
    updateConfirmationField(confirmationId, fieldName, newValue, modifiedBy, reason) {
        const confirmation = this.confirmations.get(confirmationId);
        if (!confirmation)
            return false;
        const beforeState = this.deepClone(confirmation);
        const oldValue = String(confirmation[fieldName]);
        const modification = {
            fieldName: String(fieldName),
            oldValue,
            newValue: String(newValue),
            modifiedBy,
            modifiedAt: this.getNow(),
            reason
        };
        confirmation[fieldName] = newValue;
        confirmation.manualModifications.push(modification);
        this.createHistoryRecord(confirmationId, 'CONFIRMATION', types_1.ChangeType.UPDATE, modifiedBy, beforeState, this.deepClone(confirmation), `修改字段[${fieldName}]: "${oldValue}" → "${newValue}"`);
        return true;
    }
    getHistory(entityId) {
        return this.historyRecords.filter(r => r.entityId === entityId);
    }
    getAllHistory() {
        return [...this.historyRecords];
    }
    getStatusFlow(confirmationId) {
        const history = this.getHistory(confirmationId);
        const flow = [];
        for (const record of history) {
            if (record.changeType === types_1.ChangeType.CREATE && record.afterState) {
                flow.push({
                    status: record.afterState.status,
                    time: record.changedAt,
                    operator: record.changedBy
                });
            }
            else if (record.changeType === types_1.ChangeType.STATUS_CHANGE && record.afterState) {
                flow.push({
                    status: record.afterState.status,
                    time: record.changedAt,
                    operator: record.changedBy
                });
            }
        }
        return flow;
    }
    saveExRightsReview(review) {
        this.exRightsReviews.set(review.id, review);
    }
    getExRightsReview(id) {
        return this.exRightsReviews.get(id);
    }
    getAllExRightsReviews() {
        return Array.from(this.exRightsReviews.values());
    }
    deleteExRightsReview(id) {
        return this.exRightsReviews.delete(id);
    }
    saveBalanceChange(balanceChange) {
        this.balanceChanges.set(balanceChange.id, balanceChange);
    }
    getBalanceChange(id) {
        return this.balanceChanges.get(id);
    }
    getAllBalanceChanges() {
        return Array.from(this.balanceChanges.values());
    }
    deleteBalanceChange(id) {
        return this.balanceChanges.delete(id);
    }
    rollbackToStatus(confirmationId, targetStatus, rolledBackBy, reason) {
        const confirmation = this.confirmations.get(confirmationId);
        if (!confirmation) {
            return { success: false, rollbackedStatus: targetStatus, message: '确认记录不存在' };
        }
        const beforeState = this.deepClone(confirmation);
        const currentStatus = confirmation.status;
        const statusOrder = [
            types_1.ProcessingStatus.IMPORTED,
            types_1.ProcessingStatus.PENDING_APPROVER_VERIFICATION,
            types_1.ProcessingStatus.APPROVER_VERIFIED,
            types_1.ProcessingStatus.EX_RIGHTS_DATE_REVIEWED,
            types_1.ProcessingStatus.BALANCE_UPDATED
        ];
        const currentIndex = statusOrder.indexOf(currentStatus);
        const targetIndex = statusOrder.indexOf(targetStatus);
        if (targetIndex >= currentIndex) {
            return {
                success: false,
                rollbackedStatus: currentStatus,
                message: '目标状态必须早于当前状态才能回滚'
            };
        }
        const exRightsIndex = statusOrder.indexOf(types_1.ProcessingStatus.EX_RIGHTS_DATE_REVIEWED);
        const balanceIndex = statusOrder.indexOf(types_1.ProcessingStatus.BALANCE_UPDATED);
        if (targetIndex < balanceIndex && confirmation.balanceUpdateId) {
            this.balanceChanges.delete(confirmation.balanceUpdateId);
            confirmation.balanceUpdateId = null;
        }
        if (targetIndex < exRightsIndex && confirmation.exRightsDateReviewId) {
            this.exRightsReviews.delete(confirmation.exRightsDateReviewId);
            confirmation.exRightsDateReviewId = null;
        }
        confirmation.status = targetStatus;
        this.createHistoryRecord(confirmationId, 'CONFIRMATION', types_1.ChangeType.ROLLBACK, rolledBackBy, beforeState, this.deepClone(confirmation), `回滚操作: ${currentStatus} → ${targetStatus}, 原因: ${reason}`);
        return {
            success: true,
            rollbackedStatus: targetStatus,
            message: `成功回滚到 ${targetStatus}`
        };
    }
}
exports.dataStore = new DataStore();
