import { ReviewTask, ReviewTaskType, TaskStatus, PaginatedResponse } from '../types';
export declare const createReviewTask: (data: {
    sampleId: string;
    assignee: string;
    taskType: ReviewTaskType;
    priority?: "HIGH" | "MEDIUM" | "LOW";
    dueDate?: string;
}, operator: string) => ReviewTask;
export declare const getReviewTaskById: (id: string) => ReviewTask;
export declare const listReviewTasks: (params?: {
    sampleId?: string;
    assignee?: string;
    status?: TaskStatus;
    taskType?: ReviewTaskType;
    priority?: "HIGH" | "MEDIUM" | "LOW";
}, page?: number, pageSize?: number) => PaginatedResponse<ReviewTask>;
export declare const updateReviewTaskStatus: (id: string, newStatus: TaskStatus, operator: string, data?: {
    opinion?: string;
    rating?: number;
}) => ReviewTask;
export declare const getReviewTaskSummary: (assignee?: string) => {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byType: Record<ReviewTaskType, number>;
    overdue: number;
};
