import { BatchStatus, InspectionType } from './types';
import { Batch } from './models';
export declare const INSPECTION_OPERATIONS: Record<string, string>;
export declare const STATE_NAMES: Record<BatchStatus, string>;
export interface StateTransition {
    from: BatchStatus;
    to: BatchStatus;
    allowed: boolean;
    reason?: string;
}
export declare const ALLOWED_TRANSITIONS: Map<BatchStatus, BatchStatus[]>;
export declare function canTransition(from: BatchStatus, to: BatchStatus): boolean;
export declare function validateTransition(from: BatchStatus, to: BatchStatus): void;
export declare function checkDuplicateSubmission(batch: Batch, inspectionType: InspectionType): void;
export declare function isTerminalStatus(status: BatchStatus): boolean;
export declare function getAllowedTargetStates(current: BatchStatus): BatchStatus[];
export declare function getNextRequiredState(current: BatchStatus): BatchStatus | null;
