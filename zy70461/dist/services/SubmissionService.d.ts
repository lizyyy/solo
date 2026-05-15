import { Submission, BatchActionType, BatchActionPreview } from '../models/types';
export interface CreateSubmissionRequest {
    batchId: string;
    studentId: string;
    studentName: string;
    courseCode: string;
    courseName: string;
    content: string;
    attachments: Array<{
        name: string;
        type: string;
        size: number;
    }>;
}
export declare class SubmissionService {
    static createSubmission(request: CreateSubmissionRequest, createdBy: string): Submission;
    static createSubmissionWithExpiredAttachment(request: CreateSubmissionRequest, createdBy: string): Submission;
    static processSubmission(submissionId: string, processedBy: string): Promise<Submission>;
    static processBatch(batchId: string, processedBy: string): Promise<number>;
    static previewBatchAction(batchId: string, actionType: BatchActionType): BatchActionPreview;
    static updateSubmissionField(submissionId: string, fieldName: string, oldValue: string | undefined, newValue: string, changeReason: string, sourceSystem: string, changedBy: string): Submission | null;
    static getSubmissionWithHistory(submissionId: string): {
        submission: Submission | null;
        history: any[];
    };
    static getBatchStats(batchId: string): {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        attachmentExpired: number;
    };
    static getAllBatches(): string[];
}
