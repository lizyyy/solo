import { CompensationAction, ServiceResult } from '../types';
export interface CreateCompensationInput {
    relatedRecordId: string;
    relatedRecordType: 'borrow' | 'damage' | 'repair' | 'tour';
    actionType: string;
    description: string;
    parameters: Record<string, unknown>;
    maxAttempts?: number;
}
export declare function createCompensationAction(input: CreateCompensationInput): ServiceResult<CompensationAction>;
export declare function attemptCompensation(actionId: string, handler: (action: CompensationAction) => ServiceResult): ServiceResult;
export declare function listCompensationActions(statusFilter?: string, relatedRecordType?: string): ServiceResult<CompensationAction[]>;
export declare function retryAllPending(): ServiceResult<{
    total: number;
    successCount: number;
    failedCount: number;
    results: Array<{
        actionId: string;
        success: boolean;
        message: string;
    }>;
}>;
export declare function getCompensationStatusLabel(status: string): string;
export declare function getRelatedRecordTypeLabel(type: string): string;
