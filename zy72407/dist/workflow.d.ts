import { WorkflowState, StepName, ConsumptionRecord, ImportBatch } from './types';
export declare function createInitialWorkflow(): WorkflowState;
export declare function advanceStep(state: WorkflowState, stepName: StepName, operator: string): WorkflowState;
export declare function step1ImportTunerMessages(tunerLines: string[], operator: string): {
    records: ConsumptionRecord[];
    batch: ImportBatch;
    workflow: WorkflowState;
};
export declare function step2ReviewGroupSignup(groupLines: string[], operator: string, currentWorkflow: WorkflowState): {
    records: ConsumptionRecord[];
    batch: ImportBatch;
    workflow: WorkflowState;
};
export declare function step3UpdateSettlement(operator: string, currentWorkflow: WorkflowState): {
    records: ConsumptionRecord[];
    workflow: WorkflowState;
};
export declare function canAdvanceToStep(state: WorkflowState, targetStep: StepName): boolean;
export declare function isStepCompleted(state: WorkflowState, stepName: StepName): boolean;
export declare function getPendingReviews(records: ConsumptionRecord[]): ConsumptionRecord[];
