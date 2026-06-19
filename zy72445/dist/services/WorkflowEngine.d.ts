import { WorkflowStep, HumanReadableError, ApprovalRecord, Snapshot } from '../types';
export declare class WorkflowEngine {
    private store;
    private rulesEngine;
    private historyService;
    constructor();
    initializeWorkflow(trackId: string, createdBy: string, importBatchId?: string): ApprovalRecord;
    takeSnapshot(approvalId: string, createdBy: string): Snapshot | undefined;
    advanceStep(approvalId: string, nextStep: WorkflowStep, operator: string): {
        success: boolean;
        record?: ApprovalRecord;
        error?: HumanReadableError;
    };
    completeStep(approvalId: string, operator: string, remarks?: string): {
        success: boolean;
        record?: ApprovalRecord;
        error?: HumanReadableError;
    };
    executeRollback(approvalId: string, operator: string, reason: string): {
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
    getCurrentStepInfo(approvalId: string): {
        step: WorkflowStep;
        stepName: string;
        canAdvance: boolean;
        blockers: HumanReadableError[];
    } | undefined;
    getAllApprovals(): ApprovalRecord[];
    getApproval(id: string): ApprovalRecord | undefined;
    getApprovalByTrackId(trackId: string): ApprovalRecord | undefined;
}
