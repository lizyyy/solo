import { Task, TaskStatus, RecoveryCondition, FailureRecord, AuditHistory } from '../types';
declare class DataStore {
    private tasks;
    private recoveryConditions;
    private failureRecords;
    private auditHistories;
    createTask(data: Omit<Task, 'id' | 'status' | 'failureCount' | 'hasQueuedRetry' | 'createdAt' | 'updatedAt'>): Task;
    getTask(id: string): Task | undefined;
    getTaskByCode(taskCode: string): Task | undefined;
    updateTask(id: string, data: Partial<Task>): Task | undefined;
    listTasks(query?: {
        status?: TaskStatus;
        taskCode?: string;
        schedulerName?: string;
        page?: number;
        pageSize?: number;
    }): {
        total: number;
        data: Task[];
    };
    addRecoveryCondition(taskId: string, data: Omit<RecoveryCondition, 'id' | 'taskId' | 'isMet' | 'createdAt'>): RecoveryCondition;
    getRecoveryConditions(taskId: string): RecoveryCondition[];
    updateRecoveryCondition(conditionId: string, data: Partial<RecoveryCondition>): RecoveryCondition | undefined;
    addFailureRecord(taskId: string, data: Omit<FailureRecord, 'id' | 'taskId'>): FailureRecord;
    getFailureRecords(taskId: string): FailureRecord[];
    updateFailureRecord(recordId: string, data: Partial<FailureRecord>): FailureRecord | undefined;
    addAuditHistory(taskId: string, data: Omit<AuditHistory, 'id' | 'taskId' | 'createdAt'>): AuditHistory;
    getAuditHistories(taskId: string): AuditHistory[];
    getAllTasks(): Task[];
    clearAll(): void;
}
export declare const store: DataStore;
export {};
