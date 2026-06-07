import { WorkflowStep, HumanReadableError, ApprovalRecord } from '../types';
export declare class WorkflowEngine {
    private store;
    private rulesEngine;
    private historyService;
    constructor();
    initializeWorkflow(trackId: string, createdBy: string): ApprovalRecord;
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
