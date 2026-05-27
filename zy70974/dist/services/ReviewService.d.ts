import { ReconciliationRecord, ReviewAction, AuditLogEntry } from '../types';
export declare class ReviewService {
    private createAuditLog;
    private createManualDiscrepancy;
    processReviewAction(record: ReconciliationRecord, action: ReviewAction): ReconciliationRecord;
    batchReview(records: ReconciliationRecord[], recordIds: string[], action: Omit<ReviewAction, 'recordId'>): ReconciliationRecord[];
    getAuditTrail(record: ReconciliationRecord): AuditLogEntry[];
    explainFinalStatus(record: ReconciliationRecord): {
        status: string;
        reason: string;
        evidence: string[];
    };
    traceCheckInSource(record: ReconciliationRecord): {
        hasCheckIn: boolean;
        checkInTime?: Date;
        checkInSource: string;
        relatedRecords: {
            type: string;
            id: string;
            status: string;
        }[];
    };
}
