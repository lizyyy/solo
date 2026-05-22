import { BillingRecord, ReviewStatus, ReviewNote } from '../types';
export declare class ReviewService {
    approveRecord(recordId: string, userId: string, userName: string, comment: string): Promise<BillingRecord | undefined>;
    rejectRecord(recordId: string, userId: string, userName: string, comment: string): Promise<BillingRecord | undefined>;
    requestMoreInfo(recordId: string, userId: string, userName: string, comment: string): Promise<BillingRecord | undefined>;
    modifyRecord(recordId: string, userId: string, userName: string, comment: string, modifications: Partial<BillingRecord>): BillingRecord | undefined;
    addComment(recordId: string, userId: string, userName: string, comment: string): Promise<BillingRecord | undefined>;
    recalculateAndReview(recordId: string, userId: string, userName: string, comment: string): BillingRecord | undefined;
    getReviewHistory(recordId: string): ReviewNote[] | undefined;
    getRecordsByStatus(status: ReviewStatus): BillingRecord[];
    getPendingRecords(): BillingRecord[];
    getApprovedRecords(): BillingRecord[];
    getStatistics(): {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        needsMoreInfo: number;
        withAnomalies: number;
        unresolvedAnomalies: number;
    };
}
export declare const reviewService: ReviewService;
