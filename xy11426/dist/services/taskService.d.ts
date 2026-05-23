import { TaskStatus } from '../types';
export interface CreateTaskOptions {
    batchId?: string;
    taskType: string;
    maxRetries?: number;
}
export interface TaskError {
    message: string;
    stack?: string;
}
export declare function createTask(options: CreateTaskOptions): string;
export declare function startTask(taskId: string): void;
export declare function completeTask(taskId: string): void;
export declare function failTask(taskId: string, error: TaskError): TaskStatus;
export declare function setManualTask(taskId: string): void;
export declare function retryTask(taskId: string): void;
export declare function getTask(taskId: string): any;
export declare function getTasksByStatus(status: TaskStatus): any[];
export declare function getPendingTasks(): any[];
export declare function getRetryTasks(): any[];
export declare function getManualTasks(): any[];
export declare function getFailedTasks(): any[];
export declare function getTasksByBatch(batchId: string): any[];
export declare function processPendingTasks(processor: (task: any) => Promise<void>): void;
