import { Discrepancy, ReviewResult, ReviewAction, ReviewDecision } from '../types';
export declare class ReviewService {
    reviewDiscrepancy(discrepancyId: string, result: ReviewResult, action: ReviewAction, notes: string, reviewedBy: string, supportingEvidence?: string[]): Promise<{
        success: boolean;
        decision: ReviewDecision;
        updatedDiscrepancy?: Discrepancy;
    }>;
    private applyResolutionAction;
    private applyBedAction;
    private applyPatientAction;
    private applyWorkOrderAction;
    getDiscrepancyReviewHistory(discrepancyId: string): {
        discrepancy: Discrepancy | undefined;
        decisions: ReviewDecision[];
        auditLogs: any[];
    };
    getPendingReviews(): Discrepancy[];
    getReviewedDiscrepancies(): Discrepancy[];
    batchReview(discrepancyIds: string[], result: ReviewResult, action: ReviewAction, notes: string, reviewedBy: string): Promise<{
        success: boolean;
        results: Array<{
            discrepancyId: string;
            success: boolean;
            error?: string;
        }>;
    }>;
    getPatientAuditTrail(patientId: string): {
        patientInfo: any;
        history: any[];
        auditLogs: any[];
        relatedDiscrepancies: any[];
    };
    generateDiscrepancyExplanation(discrepancyId: string): {
        summary: string;
        detailedExplanation: string;
        rootCause: string;
        recommendedActions: string[];
        supportingEvidence: any[];
    };
}
export declare const reviewService: ReviewService;
