import { ApprovalStatus, HumanReadableError, TrackRemark, ApprovalRecord } from '../types';
export declare class BoundaryRulesEngine {
    private store;
    constructor();
    detectReworkReason(content: string): {
        hasReworkReason: boolean;
        detectedKeywords: string[];
        reworkReason?: string;
    };
    canTransitionStatus(currentStatus: ApprovalStatus, nextStatus: ApprovalStatus): boolean;
    validateStatusTransition(currentStatus: ApprovalStatus, nextStatus: ApprovalStatus, trackId: string): {
        valid: boolean;
        error?: HumanReadableError;
    };
    canRollback(status: ApprovalStatus): boolean;
    validateRollback(approvalId: string): {
        valid: boolean;
        error?: HumanReadableError;
    };
    processTrackRemark(trackId: string, content: string, createdBy: string): {
        remark: TrackRemark;
        approvalImpact: {
            shouldSetReworkRequired: boolean;
            warning?: HumanReadableError;
        };
    };
    canMarkNormal(approval: ApprovalRecord, reviewedBy?: string): boolean;
}
