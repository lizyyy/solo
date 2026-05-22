import { RecordStatus, StateChange, Operator, TeaMaterialRecord, PermissionLevel } from '../models/types';
export declare class StateManager {
    private operator;
    constructor(operator: Operator);
    getCurrentOperator(): Operator;
    hasPermission(required: PermissionLevel): boolean;
    ensurePermission(required: PermissionLevel): void;
    transitionState(recordId: string, fromStatus: RecordStatus | null, toStatus: RecordStatus, reason: string, metadata?: Record<string, any>): Promise<StateChange>;
    transitionRecord(record: TeaMaterialRecord, toStatus: RecordStatus, reason: string, metadata?: Record<string, any>): Promise<TeaMaterialRecord>;
    private logAudit;
    logAction(action: string, resourceType: string, resourceId?: string, details?: Record<string, any>): Promise<void>;
}
export declare const createStateManager: (operatorId?: string) => Promise<StateManager>;
