import type { RefundChangeRecord, ReconciliationStatement } from '../domain/types.js';
import type { OverseasReceiptStore } from '../store/memory-store.js';
export declare class RefundAuditService {
    private store;
    constructor(store: OverseasReceiptStore);
    modifyRefundItem(itemId: string, changedBy: string, field: string, newValue: unknown, reason: string): RefundChangeRecord;
    private syncReconciliationNote;
    getRefundChangeHistory(refundItemId: string): RefundChangeRecord[];
    getReconciliationForReceipt(receiptId: string): ReconciliationStatement | undefined;
}
