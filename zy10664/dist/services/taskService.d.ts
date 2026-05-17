import { Task, RecoveryCondition, TaskDetailResponse, CreateTaskRequest, UpdateTaskRequest, ApplyRecoveryRequest, AuditRecoveryRequest, WithdrawRequest, ManualRemarkRequest, RecordFailureRequest, TaskQuery, ImportResult } from '../types';
export declare class TaskService {
    createTask(request: CreateTaskRequest): {
        success: boolean;
        data?: Task;
        errors?: any[];
    };
    getTaskDetail(id: string): {
        success: boolean;
        data?: TaskDetailResponse;
        message?: string;
    };
    updateTask(id: string, request: UpdateTaskRequest): {
        success: boolean;
        data?: Task;
        errors?: any[];
        message?: string;
    };
    listTasks(query?: TaskQuery): {
        success: boolean;
        data: {
            total: number;
            list: Task[];
        };
    };
    recordFailure(id: string, request: RecordFailureRequest): {
        success: boolean;
        data?: Task;
        errors?: any[];
        message?: string;
    };
    applyRecovery(id: string, request: ApplyRecoveryRequest): {
        success: boolean;
        data?: Task;
        errors?: any[];
        message?: string;
    };
    auditRecovery(id: string, request: AuditRecoveryRequest): {
        success: boolean;
        data?: Task;
        errors?: any[];
        message?: string;
    };
    withdraw(id: string, request: WithdrawRequest): {
        success: boolean;
        data?: Task;
        errors?: any[];
        message?: string;
    };
    addManualRemark(id: string, request: ManualRemarkRequest): {
        success: boolean;
        data?: Task;
        errors?: any[];
        message?: string;
    };
    meetRecoveryCondition(taskId: string, conditionId: string, operator: string): {
        success: boolean;
        data?: RecoveryCondition;
        message?: string;
    };
    exportTasks(): {
        success: boolean;
        data: Task[];
    };
    importTasks(data: any[]): {
        success: boolean;
        data: ImportResult;
    };
}
export declare const taskService: TaskService;
