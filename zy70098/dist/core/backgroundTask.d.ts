import { BackgroundTask } from '../types';
export interface TaskExecutionContext {
    task: BackgroundTask;
    progress: (percentage: number, message: string) => void;
    shouldCancel: () => boolean;
}
export interface TaskHandler {
    type: 'deviation_calculation' | 'settlement';
    execute: (context: TaskExecutionContext) => Promise<{
        success: boolean;
        result?: Record<string, unknown>;
        error?: string;
    }>;
}
export interface TaskQueueConfig {
    maxConcurrent: number;
    retryDelayMs: number;
    maxRetryDelayMs: number;
    backoffMultiplier: number;
}
export declare const DEFAULT_QUEUE_CONFIG: TaskQueueConfig;
export declare class TaskQueue {
    private config;
    private pendingTasks;
    private runningTasks;
    private handlers;
    private taskResults;
    constructor(config?: Partial<TaskQueueConfig>);
    registerHandler(handler: TaskHandler): void;
    createTask(type: 'deviation_calculation' | 'settlement', batchId: string, payload: Record<string, unknown>, options?: {
        enrollmentId?: string;
        priority?: number;
        maxAttempts?: number;
    }): BackgroundTask;
    getTaskStatus(taskId: string): BackgroundTask | undefined;
    getTaskResult(taskId: string): {
        success: boolean;
        result?: Record<string, unknown>;
        error?: string;
        completedAt: Date;
    } | undefined;
    private scheduleExecution;
    private executeTask;
    private handleTaskSuccess;
    private handleTaskFailure;
    getPendingTasks(): BackgroundTask[];
    getTaskStats(): {
        pending: number;
        running: number;
        completed: number;
        failed: number;
    };
}
export declare function calculateBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number, multiplier?: number): number;
export declare function shouldRetry(attemptCount: number, maxAttempts: number): boolean;
