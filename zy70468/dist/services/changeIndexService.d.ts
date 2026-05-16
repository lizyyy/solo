import { ChangeRecord, ManualCorrection, QueryFilter } from '../types';
import { ChangeIndexDB } from '../db';
export declare function getDB(): ChangeIndexDB;
export declare function initDB(): Promise<ChangeIndexDB>;
export declare function queryRecords(filter?: QueryFilter): ChangeRecord[];
export declare function getRecordWithCorrections(recordId: string): {
    record: ChangeRecord;
    corrections: ManualCorrection[];
} | null;
export declare function manualCorrect(recordId: string, fieldName: string, oldValue: string, newValue: string, operator: string, remark: string, approvalNode: string): Promise<void>;
export declare function exportToJSON(filter?: QueryFilter): string;
export declare function exportToMarkdown(filter?: QueryFilter): string;
export declare function saveExportFile(content: string, format: 'json' | 'md', outputDir?: string): string;
export declare function getBatches(): import("../types").Batch[];
export declare function getRecordsByApprovalNode(approvalNode: string): {
    record: ChangeRecord;
    corrections: ManualCorrection[];
}[];
export declare function getApprovalNodeHistory(recordId: string): ManualCorrection[];
