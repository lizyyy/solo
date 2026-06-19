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
            this.workflowEngine.initializeWorkflow(track.trackId, importedBy, result.batchId);
        }
        return result;
    }
    addTrackRemark(trackId, content, createdBy) {
        const alias = this.store.getTrackAliasByTrackId(trackId);
        if (!alias) {
            return { success: false, error: (0, errorMessages_1.getHumanReadableError)('track_not_found') };
        }
        const result = this.rulesEngine.processTrackRemark(trackId, content, createdBy);
        const approval = this.store.getApprovalRecordByTrackId(trackId);
        if (result.approvalImpact.shouldSetReworkRequired) {
            if (approval) {
                const oldStatus = approval.status;
                this.store.updateApprovalRecord(approval.id, {
                    status: types_1.ApprovalStatus.REWORK_REQUIRED
                });
                this.historyService.recordChange('approval_record', approval.id, 'status', oldStatus, types_1.ApprovalStatus.REWORK_REQUIRED, createdBy, '检测到返工原因，自动标记为需返工', alias.importBatchId, 'approval_record', approval.id);
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
            const alias = this.store.getTrackAliasByTrackId(oldRemark.trackId);
            const approval = this.store.getApprovalRecordByTrackId(oldRemark.trackId);
            this.historyService.recordChange('track_remark', remarkId, 'content', oldRemark.content, newContent, updatedBy, '修改轨道备注', alias?.importBatchId, approval ? 'approval_record' : undefined, approval?.id);
            if (detection.hasReworkReason && !oldRemark.hasReworkReason) {
                if (approval) {
                    const oldStatus = approval.status;
                    this.store.updateApprovalRecord(approval.id, {
                        status: types_1.ApprovalStatus.REWORK_REQUIRED
                    });
                    this.historyService.recordChange('approval_record', approval.id, 'status', oldStatus, types_1.ApprovalStatus.REWORK_REQUIRED, updatedBy, '备注修改后检测到返工原因', alias?.importBatchId, 'approval_record', approval.id);
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
        const record = this.store.createRehearsalChange({
            trackId,
            changeType,
            changeContent,
            createdBy
        });
        const alias = this.store.getTrackAliasByTrackId(trackId);
        const approval = this.store.getApprovalRecordByTrackId(trackId);
        this.historyService.recordChange('rehearsal_change', record.id, 'add', '', JSON.stringify({ changeType, changeContent }), createdBy, '添加排练变更记录', alias?.importBatchId, approval ? 'approval_record' : undefined, approval?.id);
        return record;
    }
    advanceWorkflow(approvalId, operator) {
        const approval = this.store.getApprovalRecord(approvalId);
        if (!approval) {
            return { success: false, error: (0, errorMessages_1.getHumanReadableError)('track_not_found') };
        }
        if (approval.currentStep === types_1.WorkflowStep.REHEARSAL_UPDATE) {
            const changes = this.store.getRehearsalChangesByTrack(approval.trackId);
            if (changes.length === 0) {
                return { success: false, error: (0, errorMessages_1.getHumanReadableError)('missing_rehearsal_change') };
            }
        }
        return this.workflowEngine.completeStep(approvalId, operator);
    }
    rollback(approvalId, operator, reason) {
        return this.workflowEngine.executeRollback(approvalId, operator, reason);
    }
    applyForRework(approvalId, reason, appliedBy) {
        return this.workflowEngine.applyForRework(approvalId, reason, appliedBy);
    }
    approveReworkApplication(applicationId, approvedBy) {
        return this.workflowEngine.approveReworkApplication(applicationId, approvedBy);
    }
    rejectReworkApplication(applicationId, rejectedBy) {
        return this.workflowEngine.rejectReworkApplication(applicationId, rejectedBy);
    }
    getReworkApplications(approvalId) {
        return this.store.getReworkApplicationsByApproval(approvalId);
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
    getChangeHistoryByBatch(importBatchId) {
        return this.historyService.getHistoryByImportBatch(importBatchId);
    }
    getChangeHistoryByAffected(entityType, entityId) {
        return this.historyService.getHistoryByAffectedEntity(entityType, entityId);
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