"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEngine = void 0;
const DataStore_1 = require("../store/DataStore");
const boundaryRules_1 = require("../constants/boundaryRules");
const errorMessages_1 = require("../constants/errorMessages");
const types_1 = require("../types");
const BoundaryRulesEngine_1 = require("./BoundaryRulesEngine");
const ChangeHistoryService_1 = require("./ChangeHistoryService");
class WorkflowEngine {
    constructor() {
        this.store = DataStore_1.DataStore.getInstance();
        this.rulesEngine = new BoundaryRulesEngine_1.BoundaryRulesEngine();
        this.historyService = new ChangeHistoryService_1.ChangeHistoryService();
    }
    initializeWorkflow(trackId, createdBy) {
        return this.store.createApprovalRecord({
            trackId,
            status: types_1.ApprovalStatus.PENDING,
            currentStep: types_1.WorkflowStep.ALIAS_IMPORT,
            displayMode: types_1.DisplayMode.LIST,
            remarks: '曲目别名表已导入，等待审批',
            reviewedBy: undefined,
            reviewedAt: undefined
        });
    }
    advanceStep(approvalId, nextStep, operator) {
        const approval = this.store.getApprovalRecord(approvalId);
        if (!approval) {
            return { success: false, error: (0, errorMessages_1.getHumanReadableError)('track_not_found') };
        }
        const steps = boundaryRules_1.BOUNDARY_RULES.workflow.steps;
        const currentIndex = steps.indexOf(approval.currentStep);
        const nextIndex = steps.indexOf(nextStep);
        if (nextIndex !== currentIndex + 1) {
            return { success: false, error: (0, errorMessages_1.getHumanReadableError)('invalid_status_transition') };
        }
        if (boundaryRules_1.BOUNDARY_RULES.reworkReason.preventAutoNormal) {
            const hasRework = this.store.hasReworkReasonForTrack(approval.trackId);
            if (hasRework) {
                return { success: false, error: (0, errorMessages_1.getHumanReadableError)('rework_reason_pending') };
            }
        }
        if (nextStep === types_1.WorkflowStep.PHOTO_REVIEW && boundaryRules_1.BOUNDARY_RULES.workflow.requirePhotoReview) {
            const photos = this.store.getCheckinPhotosByTrack(approval.trackId);
            const hasReviewedPhoto = photos.some(p => p.reviewed);
            if (!hasReviewedPhoto) {
                return { success: false, error: (0, errorMessages_1.getHumanReadableError)('missing_checkin_photo') };
            }
        }
        const oldStep = approval.currentStep;
        const updated = this.store.updateApprovalRecord(approvalId, {
            currentStep: nextStep,
            status: types_1.ApprovalStatus.REVIEWING
        });
        if (updated) {
            this.historyService.recordChange('approval_record', approvalId, 'currentStep', oldStep, nextStep, operator, '工作流推进');
        }
        return { success: true, record: updated };
    }
    completeStep(approvalId, operator, remarks) {
        const approval = this.store.getApprovalRecord(approvalId);
        if (!approval) {
            return { success: false, error: (0, errorMessages_1.getHumanReadableError)('track_not_found') };
        }
        const steps = boundaryRules_1.BOUNDARY_RULES.workflow.steps;
        const currentIndex = steps.indexOf(approval.currentStep);
        const isLastStep = currentIndex === steps.length - 1;
        const now = this.store.now();
        let updated;
        if (isLastStep) {
            if (!this.rulesEngine.canMarkNormal(approval, operator)) {
                return { success: false, error: (0, errorMessages_1.getHumanReadableError)('rework_reason_pending') };
            }
            const oldStatus = approval.status;
            updated = this.store.updateApprovalRecord(approvalId, {
                status: types_1.ApprovalStatus.NORMAL,
                reviewedBy: operator,
                reviewedAt: now,
                remarks: remarks || approval.remarks
            });
            if (updated) {
                this.historyService.recordChange('approval_record', approvalId, 'status', oldStatus, types_1.ApprovalStatus.NORMAL, operator, '审批完成，标记为正常');
            }
        }
        else {
            const nextStep = steps[currentIndex + 1];
            return this.advanceStep(approvalId, nextStep, operator);
        }
        return { success: true, record: updated };
    }
    getCurrentStepInfo(approvalId) {
        const approval = this.store.getApprovalRecord(approvalId);
        if (!approval)
            return undefined;
        const blockers = [];
        const hasRework = this.store.hasReworkReasonForTrack(approval.trackId);
        if (hasRework) {
            blockers.push((0, errorMessages_1.getHumanReadableError)('rework_reason_pending'));
        }
        if (approval.currentStep === types_1.WorkflowStep.PHOTO_REVIEW && boundaryRules_1.BOUNDARY_RULES.workflow.requirePhotoReview) {
            const photos = this.store.getCheckinPhotosByTrack(approval.trackId);
            const hasReviewedPhoto = photos.some(p => p.reviewed);
            if (!hasReviewedPhoto) {
                blockers.push((0, errorMessages_1.getHumanReadableError)('missing_checkin_photo'));
            }
        }
        const stepNames = {
            [types_1.WorkflowStep.ALIAS_IMPORT]: '曲目别名表导入',
            [types_1.WorkflowStep.PHOTO_REVIEW]: '课时签到照片复核',
            [types_1.WorkflowStep.REHEARSAL_UPDATE]: '排练变更记录更新'
        };
        return {
            step: approval.currentStep,
            stepName: stepNames[approval.currentStep],
            canAdvance: blockers.length === 0,
            blockers
        };
    }
    getAllApprovals() {
        return this.store.getAllApprovalRecords();
    }
    getApproval(id) {
        return this.store.getApprovalRecord(id);
    }
    getApprovalByTrackId(trackId) {
        return this.store.getApprovalRecordByTrackId(trackId);
    }
}
exports.WorkflowEngine = WorkflowEngine;
//# sourceMappingURL=WorkflowEngine.js.map