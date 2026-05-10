import { BackgroundTask, BackgroundTaskType, BackgroundTaskStatus } from '../types';
export declare const createBackgroundTask: (taskType: BackgroundTaskType, payload: Record<string, any>, maxRetries?: number) => BackgroundTask;
export declare const getBackgroundTaskById: (id: string) => BackgroundTask;
export declare const listBackgroundTasks: (params?: {
    status?: BackgroundTaskStatus;
    taskType?: BackgroundTaskType;
}, page?: number, pageSize?: number) => {
    items: BackgroundTask[];
    total: number;
};
export declare const retryBackgroundTask: (id: string) => BackgroundTask;
export declare const cancelBackgroundTask: (id: string) => BackgroundTask;
export declare const startTaskQueue: () => void;
export declare const stopTaskQueue: () => void;
export declare const getTaskQueueStatus: () => {
    running: boolean;
    intervalMs: number;
    retryDelayMs: number;
};
