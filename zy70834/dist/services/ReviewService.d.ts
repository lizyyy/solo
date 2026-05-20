import { ReconciliationResult, ReviewAction } from '../types';
import { ReconciliationEngine } from './ReconciliationEngine';
export declare class ReviewService {
    private engine;
    constructor(engine: ReconciliationEngine);
    performReview(action: ReviewAction): ReconciliationResult | null;
    private approveResult;
    private rejectResult;
    private requestMoreInfo;
    private modifyAndRecalculate;
    private applyModification;
    private recalculateDiscrepancies;
    batchApprove(resultIds: string[], reviewer: string): ReconciliationResult[];
    getModificationHistory(result: ReconciliationResult): string | null;
    getAuditTrail(result: ReconciliationResult): {
        status: string;
        reviewedBy?: string;
        reviewedAt?: string;
        notes?: string;
    };
}
