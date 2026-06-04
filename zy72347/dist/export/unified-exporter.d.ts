import { DataRecord, ProcessingResult } from '../types';
export type ExportFormat = 'json' | 'csv' | 'detail' | 'summary';
export interface ExportOptions {
    format: ExportFormat;
    includeMixedOnly?: boolean;
    includeRawValues?: boolean;
    includeChangeHistory?: boolean;
    includeAnnotations?: boolean;
    displayFormat?: 'decimal' | 'percentage';
    outputPath?: string;
    operator: string;
}
export interface RecordView {
    id: string;
    originalRowNumber: number;
    sourceFile: string;
    importTime: string;
    importedBy: string;
    status: string;
    statusText: string;
    currentStep: string;
    workflowStatus: string;
    hasMixedFormat: boolean;
    formatDetected: string;
    values: Record<string, string>;
    rawValues?: Record<string, {
        original: string;
        format: string;
        numericValue: number;
    }>;
    normalizedValues?: Record<string, number>;
    changeHistory?: Array<{
        time: string;
        operator: string;
        field: string;
        oldValue: string;
        newValue: string;
        reason: string;
    }>;
    annotations?: Array<{
        time: string;
        author: string;
        content: string;
        screenshotRef?: string;
    }>;
    reviewAssignee?: string;
    reviewDecision?: string;
    reviewTime?: string;
    completedBy?: string;
    completedTime?: string;
}
export declare function buildRecordView(record: DataRecord, options?: {
    includeRawValues?: boolean;
    includeChangeHistory?: boolean;
    includeAnnotations?: boolean;
    displayFormat?: 'decimal' | 'percentage';
}): RecordView;
export declare function getRecords(options?: {
    includeMixedOnly?: boolean;
}): ProcessingResult<RecordView[]>;
export declare function getRecordDetail(recordId: string): ProcessingResult<RecordView>;
export declare function exportData(options: ExportOptions): ProcessingResult<string>;
