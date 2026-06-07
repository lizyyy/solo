import { ReconciliationStore } from '../store';
export interface ParsedContractRow {
    rawContent: string;
    performerName?: string;
    songName?: string;
    contractReference?: string;
    performanceDate?: string;
    importBatchId: string;
    sourceFileName?: string;
}
export declare function parseContractFile(filePath: string, batchId: string, sourceFileName?: string): ParsedContractRow[];
export declare function importContractFile(store: ReconciliationStore, filePath: string, operator: string, isLateRefresh?: boolean): {
    batchId: string;
    recordCount: number;
    isLateRefresh: boolean;
};
