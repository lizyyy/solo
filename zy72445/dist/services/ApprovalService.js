"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = void 0;
const DataStore_1 = require("../store/DataStore");
const ImportService_1 = require("./ImportService");
const BoundaryRulesEngine_1 = require("./BoundaryRulesEngine");
const WorkflowEngine_1 = require("./WorkflowEngine");
const DisplayModeService_1 = require("./DisplayModeService");
const ChangeHistoryService_1 = require("./ChangeHistoryService");
const errorMessages_1 = require("../constants/errorMessages");
const types_1 = require("../types");
class ApprovalService {
    constructor() {
        this.store = DataStore_1.DataStore.getInstance();
        this.importService = new ImportService_1.ImportService();
        this.rulesEngine = new BoundaryRulesEngine_1.BoundaryRulesEngine();
        this.workflowEngine = new WorkflowEngine_1.WorkflowEngine();
        this.displayModeService = new DisplayModeService_1.DisplayModeService();
        this.historyService = new ChangeHistoryService_1.ChangeHistoryService();
    }
    importTrackAliases(batchIdentifier, trackDataList, importedBy) {
        const result = this.importService.importTrackAliases(batchIdentifier, trackDataList, importedBy);
        for (const track of result.importedTracks) {
            this.workflowEngine.initializeWorkflow(track.trackId, importedBy);
        }
        return result;
    }
    addTrackRemark(trackId, content, createdBy) {
        const alias = this.store.getTrackAliasByTrackId(trackId);
        if (!alias) {
            return { success: false, error: (0, errorMessages_1.getHumanReadableError)('track_not_found') };
        }
        const result = this.rulesEngine.processTrackRemark(trackId, content, createdBy);
        if (result.approvalImpact.shouldSetReworkRequired) {
            const approval = this.store.getApprovalRecordByTrackId(trackId);
            if (approval) {
                const oldStatus = approval.status;
                this.store.updateApprovalRecord(approval.id, {
                    status: types_1.ApprovalStatus.REWORK_REQUIRED
                });
                this.historyService.recordChange('approval_record', approval.id, 'status', oldStatus, types_1.ApprovalStatus.REWORK_REQUIRED, createdBy, '检测到返工原因，自动标记为需返工');
            }
        }
        return {
            success: true,
            remark: result.remark,
            warning: result.approvalImpact.warning
        };
    }
    updateTrackRemark(remarkId, newContent, updatedBy) {
        const oldRemark = this.store.getTrackRemark(remarkId);
        if (!oldRemark) {
            return { success: false, error: (0, errorMessages_1.getHumanReadableError)('track_not_found') };
        }
        const detection = this.rulesEngine.detectReworkReason(newContent);
        const updated = this.store.updateTrackRemark(remarkId, {
            content: newContent,
            hasReworkReason: detection.hasReworkReason,
            reworkReason: detection.reworkReason
        });
        if (updated) {
            this.historyService.recordChange('track_remark', remarkId, 'content', oldRemark.content, newContent, updatedBy, '修改轨道备注');
            if (detection.hasReworkReason && !oldRemark.hasReworkReason) {
                const approval = this.store.getApprovalRecordByTrackId(oldRemark.trackId);
                if (approval) {
                    const oldStatus = approval.status;
                    this.store.updateApprovalRecord(approval.id, {
                        status: types_1.ApprovalStatus.REWORK_REQUIRED
                    });
                    this.historyService.recordChange('approval_record', approval.id, 'status', oldStatus, types_1.ApprovalStatus.REWORK_REQUIRED, updatedBy, '备注修改后检测到返工原因');
                }
            }
            return {
                success: true,
                remark: updated,
                warning: detection.hasReworkReason ? (0, errorMessages_1.getHumanReadableError)('rework_reason_pending') : undefined
            };
        }
        return { success: false };
    }
    uploadCheckinPhoto(classSessionId, trackId, photoUrl, uploadedBy) {
        return this.store.createCheckinPhoto({
            classSessionId,
            trackId,
            photoUrl,
            uploadedBy,
            reviewed: false
        });
    }
    reviewCheckinPhoto(photoId, reviewedBy) {
        return this.store.reviewCheckinPhoto(photoId, reviewedBy);
    }
    addRehearsalChange(trackId, changeType, changeContent, createdBy) {
        return this.store.createRehearsalChange({
            trackId,
            changeType,
            changeContent,
            createdBy
        });
    }
    advanceWorkflow(approvalId, operator) {
        return this.workflowEngine.completeStep(approvalId, operator);
    }
    getWorkflowStepInfo(approvalId) {
        return this.workflowEngine.getCurrentStepInfo(approvalId);
    }
    setDisplayMode(approvalId, displayMode, operator) {
        return this.displayModeService.setDisplayMode(approvalId, displayMode, operator);
    }
    getNavigationTargets(trackId) {
        return this.displayModeService.getNavigationTargets(trackId);
    }
    navigateToSource(trackId, targetType, targetId) {
        return this.displayModeService.navigateToSource(trackId, targetType, targetId);
    }
    getChangeHistory(entityType, entityId) {
        return this.historyService.getDiffForEntity(entityType, entityId);
    }
    getApprovalRecord(approvalId) {
        return this.store.getApprovalRecord(approvalId);
    }
    getApprovalByTrackId(trackId) {
        return this.store.getApprovalRecordByTrackId(trackId);
    }
    getAllApprovals() {
        return this.store.getAllApprovalRecords();
    }
    getTrackRemarks(trackId) {
        return this.store.getTrackRemarksByTrackId(trackId);
    }
}
exports.ApprovalService = ApprovalService;
//# sourceMappingURL=ApprovalService.js.map