import { DataRecord, ProcessingResult, WorkflowStep } from '../types';
export interface AnnotationOptions {
    recordId: string;
    author: string;
    content: string;
    screenshotRef?: string;
}
export interface ReviewOptions {
    recordId: string;
    reviewer: string;
    decision: 'approve' | 'reject' | 'rollback';
    comment: string;
    targetFormat?: 'decimal' | 'percentage';
}
export interface UpdateOptions {
    recordId: string;
    operator: string;
    fieldValues: Record<string, string>;
    reason: string;
}
export declare function canAdvanceStep(record: DataRecord, targetStep: WorkflowStep): boolean;
export declare function addAnnotation(options: AnnotationOptions): ProcessingResult<DataRecord>;
export declare function reviewRecord(options: ReviewOptions): ProcessingResult<DataRecord>;
export declare function updateRecord(options: UpdateOptions): ProcessingResult<DataRecord>;
export declare function rollbackRecord(recordId: string, operator: string, reason: string): ProcessingResult<DataRecord>;
export declare function getWorkflowStatus(record: DataRecord): string;
