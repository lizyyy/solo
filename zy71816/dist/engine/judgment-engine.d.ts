import type { ReceiptLine, ReceiptHistoryEntry, ProcessingBatch } from '../domain/types.js';
import type { OverseasReceiptStore } from '../store/memory-store.js';
export interface EngineConfig {
    crossPeriodContactPerson: string;
    platformContactMap?: Record<string, string>;
}
export declare class JudgmentEngine {
    private store;
    private config;
    constructor(store: OverseasReceiptStore, config: EngineConfig);
    processBatch(receipts: ReceiptLine[]): ProcessingBatch;
    private judge;
    private detectCrossPeriodFee;
    private getContactForPlatform;
    getProcessingHistory(receiptId: string): ReceiptHistoryEntry[];
}
