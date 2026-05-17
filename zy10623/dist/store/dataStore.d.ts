import { RefundReview, AuditLog, ConflictRecord, ImportBadRow, RefundReviewStatus } from '../types';
declare class DataStore {
    private refundReviews;
    private auditLogs;
    private conflictRecords;
    private importBadRows;
    private idempotentKeys;
    saveRefundReview(review: RefundReview): RefundReview;
    getRefundReview(id: string): RefundReview | undefined;
    listRefundReviews(page: number, pageSize: number, filters?: {
        status?: RefundReviewStatus;
        userId?: string;
        orderNo?: string;
    }): {
        list: RefundReview[];
        total: number;
    };
    checkIdempotentKey(key: string): boolean;
    addIdempotentKey(key: string): void;
    saveAuditLog(log: Omit<AuditLog, 'id'>): AuditLog;
    listAuditLogs(refundReviewId: string): AuditLog[];
    saveConflictRecord(record: Omit<ConflictRecord, 'id'>): ConflictRecord;
    listConflictRecords(refundReviewId?: string): ConflictRecord[];
    saveImportBadRow(row: Omit<ImportBadRow, 'id'>): ImportBadRow;
    listImportBadRows(batchId?: string): ImportBadRow[];
    getSplitOrderGroupReviews(groupId: string): RefundReview[];
}
export declare const dataStore: DataStore;
export {};
