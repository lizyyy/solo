import { ImportTrackData } from './ImportService';
import { WorkflowStep, DisplayMode, HumanReadableError, ApprovalRecord, TrackRemark, ClassCheckinPhoto, RehearsalChangeRecord } from '../types';
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
    getChangeHistory(entityType: 'track_alias' | 'track_remark' | 'approval_record', entityId: string): {
        fieldName: string;
        oldValue: string;
        newValue: string;
        changedBy: string;
        changedAt: string;
        changeReason?: string;
    }[];
    getApprovalRecord(approvalId: string): ApprovalRecord | undefined;
    getApprovalByTrackId(trackId: string): ApprovalRecord | undefined;
    getAllApprovals(): ApprovalRecord[];
    getTrackRemarks(trackId: string): TrackRemark[];
}
