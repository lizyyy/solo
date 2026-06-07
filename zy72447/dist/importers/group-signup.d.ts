import { ReconciliationStore } from '../store';
export interface ParsedGroupSignupRow {
    originalRowNumber: number;
    rawContent: string;
    performerName?: string;
    songName?: string;
    isTemporarySubstitute?: boolean;
    substituteNote?: string;
    importBatchId: string;
}
export declare function parseGroupSignupFile(filePath: string, batchId: string): ParsedGroupSignupRow[];
export declare function importGroupSignupFile(store: ReconciliationStore, filePath: string, operator: string): {
    batchId: string;
    recordCount: number;
};
