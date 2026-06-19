import { ImportTrackData } from './ImportService';
import { WorkflowStep, DisplayMode, HumanReadableError, ApprovalRecord, TrackRemark, ClassCheckinPhoto, RehearsalChangeRecord, ReworkApplication, ChangeHistory } from '../types';
export declare class ApprovalService {
    private store;
    private importService;
    private rulesEngine;
    private workflowEngine;
    private displayModeService;
    private historyService;
    constructor();
    importTrackAliases(batchIdentifier: string, trackDataList: ImportTrackData[], importedBy: string): import("./ImportService").ImportResult;
    addTrackRemark(trackId: string, content: string, createdBy: string): {
        success: boolean;
        remark?: TrackRemark;
        warning?: HumanReadableError;
        error?: HumanReadableError;
    };
    updateTrackRemark(remarkId: string, newContent: string, updatedBy: string): {
        success: boolean;
        remark?: TrackRemark;
        warning?: HumanReadableError;
        error?: HumanReadableError;
    };
    uploadCheckinPhoto(classSessionId: string, trackId: string, photoUrl: string, uploadedBy: string): ClassCheckinPhoto;
    reviewCheckinPhoto(photoId: string, reviewedBy: string): ClassCheckinPhoto | undefined;
    addRehearsalChange(trackId: string, changeType: string, changeContent: string, createdBy: string): RehearsalChangeRecord;
    advanceWorkflow(approvalId: string, operator: string): {
        success: boolean;
        record?: ApprovalRecord;
        error?: HumanReadableError;
    };
    rollback(approvalId: string, operator: string, reason: string): {
        success: boolean;
        record?: ApprovalRecord;
        restoredRemarks?: number;
        error?: HumanReadableError;
    };
    applyForRework(approvalId: string, reason: string, appliedBy: string): {
        success: boolean;
        error?: HumanReadableError;
    };
    approveReworkApplication(applicationId: string, approvedBy: string): {
        success: boolean;
        error?: HumanReadableError;
    };
    rejectReworkApplication(applicationId: string, rejectedBy: string): {
        success: boolean;
        error?: HumanReadableError;
    };
    getReworkApplications(approvalId: string): ReworkApplication[];
    getWorkflowStepInfo(approvalId: string): {
        step: WorkflowStep;
        stepName: string;
        canAdvance: boolean;
        blockers: HumanReadableError[];
    } | undefined;
    setDisplayMode(approvalId: string, displayMode: DisplayMode, operator: string): {
        success: boolean;
        error?: HumanReadableError;
        requiresReview?: boolean;
    };
    getNavigationTargets(trackId: string): {
        type: "alias_table" | "checkin_photo" | "rehearsal_record";
        id: string;
        label: string;
    }[];
    navigateToSource(trackId: string, targetType: 'alias_table' | 'checkin_photo' | 'rehearsal_record', targetId: string): {
        success: boolean;
        context?: import("./DisplayModeService").NavigationContext;
        error?: HumanReadableError;
    };
    getChangeHistory(entityType: 'track_alias' | 'track_remark' | 'approval_record' | 'rehearsal_change', entityId: string): {
        entityType: ChangeHistory["entityType"];
        entityId: string;
        fieldName: string;
        oldValue: string;
        newValue: string;
        changedBy: string;
        changedAt: string;
        changeReason?: string;
        importBatchId?: string;
        affectedEntityType?: "approval_record" | "track_alias";
        affectedEntityId?: string;
        snapshotId?: string;
    }[];
    getChangeHistoryByBatch(importBatchId: string): ChangeHistory[];
    getChangeHistoryByAffected(entityType: 'approval_record' | 'track_alias', entityId: string): ChangeHistory[];
    getApprovalRecord(approvalId: string): ApprovalRecord | undefined;
    getApprovalByTrackId(trackId: string): ApprovalRecord | undefined;
    getAllApprovals(): ApprovalRecord[];
    getTrackRemarks(trackId: string): TrackRemark[];
}
