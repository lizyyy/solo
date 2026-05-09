import { OperationResult, EventRecord } from '../types';
export interface StateTransitionRule {
    entityType: 'batch' | 'enrollment';
    fromStatus: string;
    toStatus: string;
    allowedOperations: string[];
    errorMessage?: string;
}
export declare const BATCH_STATUS_TRANSITIONS: StateTransitionRule[];
export declare const ENROLLMENT_STATUS_TRANSITIONS: StateTransitionRule[];
export interface TransitionContext {
    entityId: string;
    operator?: string;
    notes?: string;
    additionalData?: Record<string, unknown>;
}
export declare function validateStateTransition(entityType: 'batch' | 'enrollment', fromStatus: string, toStatus: string, operation: string): OperationResult<void>;
export declare function createEventRecord(entityType: 'batch' | 'enrollment' | 'execution' | 'settlement', eventType: string, context: TransitionContext, fromStatus?: string, toStatus?: string, additionalPayload?: Record<string, unknown>): EventRecord;
export declare function getAvailableOperations(entityType: 'batch' | 'enrollment', currentStatus: string): string[];
export declare function canPerformOperation(entityType: 'batch' | 'enrollment', currentStatus: string, operation: string): boolean;
