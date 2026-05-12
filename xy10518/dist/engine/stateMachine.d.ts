import { BatchStatus, ActionType } from '../types';
export declare const STATE_TRANSITIONS: Record<BatchStatus, BatchStatus[]>;
export declare const ACTION_STATE_MAP: Record<ActionType, {
    from: BatchStatus[];
    to: BatchStatus;
}>;
export declare function canTransition(from: BatchStatus, to: BatchStatus): boolean;
export declare function validateAction(action: ActionType, currentStatus: BatchStatus): boolean;
export declare function getNextStatus(action: ActionType): BatchStatus;
