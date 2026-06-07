import { GroupSignupRecord, ContractRecord, ReconciliationResult, ReviewReason } from '../types';
import { ReconciliationStore } from '../store';
export interface MatchCandidate {
    groupRecord?: GroupSignupRecord;
    contractRecord?: ContractRecord;
    matchScore: number;
    reviewReasons: ReviewReason[];
}
export declare function findMatches(groupRecords: GroupSignupRecord[], contractRecords: ContractRecord[]): MatchCandidate[];
export declare function runReconciliation(store: ReconciliationStore, operator: string, options?: {
    lateContractBatchId?: string;
    preserveConfirmed?: boolean;
}): {
    created: number;
    updated: number;
    skipped: number;
};
export declare function confirmResult(store: ReconciliationStore, resultId: string, operator: string, notes?: string): ReconciliationResult | undefined;
export declare function rejectResult(store: ReconciliationStore, resultId: string, operator: string, notes?: string): ReconciliationResult | undefined;
export declare function rollbackResult(store: ReconciliationStore, resultId: string, operator: string, reason?: string): ReconciliationResult | undefined;
