import { WorkflowState, MaterialSource, WorkflowState as WorkflowStateType, ConflictEvidence, TrackChecklistItem } from '../types';
import { AliasImportInput } from './alias-import-service';
import { PhotoUploadInput } from './photo-review-service';
import { ScheduleImportInput } from './schedule-import-service';
export declare class WorkflowService {
    startWorkflow(source: MaterialSource): WorkflowState;
    step1_ImportAliases(batchId: string, aliasInputs: AliasImportInput[], scheduleInputs: ScheduleImportInput[]): WorkflowStateType;
    step2_ReviewPhotos(batchId: string, photoInputs: PhotoUploadInput[]): WorkflowStateType;
    step3_UpdateChecklist(batchId: string): {
        state: WorkflowStateType;
        conflicts: ConflictEvidence[];
        pendingLeaveReviews: TrackChecklistItem[];
    };
    resolveConflict(batchId: string, checklistItemId: string, confirmed: boolean, resolverName: string): WorkflowStateType;
    reviewLeaveByCoordinator(batchId: string, checklistItemId: string, coordinatorName: string): WorkflowStateType;
    canComplete(batchId: string): {
        canComplete: boolean;
        reason?: string;
    };
    getState(batchId: string): WorkflowStateType;
    formatState(state: WorkflowStateType): string;
    private getStepText;
    private getSourceText;
}
export declare const workflowService: WorkflowService;
