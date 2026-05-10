import { ReviewStatus, ReviewPriority } from '../../../common/types';
export declare class ReviewTask {
    id: string;
    taskNumber: string;
    certificateNumber: string;
    certificateId: string;
    batchNumber: string;
    batchId: string;
    transportNumber: string;
    transportId: string;
    status: ReviewStatus;
    priority: ReviewPriority;
    reasonCode: string;
    reasonDescription: string;
    contextData: Record<string, any>;
    conclusion: string;
    resolutionActions: Record<string, any>;
    assigneeId: string;
    assigneeName: string;
    assignedAt: Date;
    resolvedAt: Date;
    remarks: string;
    createdBy: string;
    createdByName: string;
    createdAt: Date;
    updatedAt: Date;
}
