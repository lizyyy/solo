import { ReviewStatus, ReviewPriority } from '../../../common/types';
export declare class CreateReviewTaskDto {
    certificateNumber?: string;
    certificateId?: string;
    batchNumber?: string;
    batchId?: string;
    transportNumber?: string;
    transportId?: string;
    reasonCode: string;
    reasonDescription: string;
    priority?: ReviewPriority;
    contextData?: Record<string, any>;
    remarks?: string;
}
export declare class ResolveReviewTaskDto {
    taskId: string;
    conclusion: string;
    resolutionActions?: Record<string, any>;
    status?: ReviewStatus;
    remarks?: string;
}
export declare class ReviewQueryDto {
    status?: string[];
    priority?: string[];
    reasonCode?: string;
    certificateNumber?: string;
    assigneeId?: string;
    page?: number;
    pageSize?: number;
}
