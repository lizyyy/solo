"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeHistoryService = void 0;
const DataStore_1 = require("../store/DataStore");
class ChangeHistoryService {
    constructor() {
        this.store = DataStore_1.DataStore.getInstance();
    }
    recordChange(entityType, entityId, fieldName, oldValue, newValue, changedBy, changeReason, importBatchId, affectedEntityType, affectedEntityId, snapshotId) {
        return this.store.addChangeHistory({
            entityType,
            entityId,
            fieldName,
            oldValue,
            newValue,
            changedBy,
            changeReason,
            importBatchId,
            affectedEntityType,
            affectedEntityId,
            snapshotId
        });
    }
    getHistoryForTrackRemark(remarkId) {
        return this.store.getChangeHistoryByEntity('track_remark', remarkId);
    }
    getHistoryForApprovalRecord(approvalId) {
        return this.store.getChangeHistoryByEntity('approval_record', approvalId);
    }
    getHistoryForTrackAlias(aliasId) {
        return this.store.getChangeHistoryByEntity('track_alias', aliasId);
    }
    getHistoryByImportBatch(importBatchId) {
        return this.store.getChangeHistoryByBatch(importBatchId);
    }
    getHistoryByAffectedEntity(entityType, entityId) {
        return this.store.getChangeHistoryByAffectedEntity(entityType, entityId);
    }
    getDiffForEntity(entityType, entityId) {
        const histories = this.store.getChangeHistoryByEntity(entityType, entityId);
        return histories.map(h => ({
            entityType: h.entityType,
            entityId: h.entityId,
            fieldName: h.fieldName,
            oldValue: h.oldValue,
            newValue: h.newValue,
            changedBy: h.changedBy,
            changedAt: h.changedAt,
            changeReason: h.changeReason,
            importBatchId: h.importBatchId,
            affectedEntityType: h.affectedEntityType,
            affectedEntityId: h.affectedEntityId,
            snapshotId: h.snapshotId
        }));
    }
    compareFieldChanges(entityType, entityId, fieldName) {
        const histories = this.store.getChangeHistoryByEntity(entityType, entityId);
        return histories
            .filter(h => h.fieldName === fieldName)
            .map(h => ({
            oldValue: h.oldValue,
            newValue: h.newValue,
            changedBy: h.changedBy,
            changedAt: h.changedAt,
            importBatchId: h.importBatchId
        }));
    }
}
exports.ChangeHistoryService = ChangeHistoryService;
//# sourceMappingURL=ChangeHistoryService.js.map