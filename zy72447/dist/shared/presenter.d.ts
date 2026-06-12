import { ReconciliationResult, GroupSignupRecord, ContractRecord, RecordStatus, ReviewReason, OperationLog } from '../types';
export declare const STATUS_LABELS: Record<RecordStatus, string>;
export declare const REASON_LABELS: Record<ReviewReason, string>;
export declare const FIELD_LABELS: Record<string, string>;
export interface DetailRow {
    id: string;
    resultId: string;
    status: RecordStatus;
    statusLabel: string;
    performerName: string;
    songName: string;
    isLateContractRefresh: boolean;
    reviewReasons: ReviewReason[];
    reviewReasonsLabel: string;
    reviewNotes: string;
    reviewedBy: string;
    reviewedAt: string;
    createdAt: string;
    updatedAt: string;
    groupOriginalRowNumber: number | '';
    groupRawContent: string;
    groupPerformerName: string;
    groupSongName: string;
    groupIsTempSubstitute: boolean;
    groupSubstituteNote: string;
    groupImportBatchId: string;
    groupImportedAt: string;
    groupManualEdits: string;
    groupManualEditsCount: number;
    contractRawContent: string;
    contractPerformerName: string;
    contractSongName: string;
    contractReference: string;
    contractPerformanceDate: string;
    contractImportBatchId: string;
    contractImportedAt: string;
    contractManualEdits: string;
    contractManualEditsCount: number;
}
export interface SummaryItem {
    label: string;
    value: number;
    key: string;
}
export interface LogRow {
    id: string;
    operationType: string;
    entityType: string;
    entityId: string;
    operator: string;
    timestamp: string;
    batchId: string;
    notes: string;
    oldStateSummary: string;
    newStateSummary: string;
}
export declare function buildDetailRow(result: ReconciliationResult, groupRecord?: GroupSignupRecord, contractRecord?: ContractRecord): DetailRow;
export declare function detailRowToExportColumns(row: DetailRow): Record<string, string | number | boolean>;
export declare function buildSummary(details: Array<{
    result: ReconciliationResult;
    groupRecord?: GroupSignupRecord;
    contractRecord?: ContractRecord;
}>): SummaryItem[];
export declare function buildLogRow(log: OperationLog): LogRow;
