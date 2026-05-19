import { Task, TaskStatus, TaskPriority, Patient, TaskStats } from '../models/types';
export declare class TaskService {
    private generateIdempotencyKey;
    checkIdempotency(key: string): Task | null;
    createTask(patient: Patient, checkType: string, checkLocation: string, priority?: TaskPriority, remarks?: string, idempotencyKey?: string): Task;
    assignTask(taskId: string, escortId: string, operator: string, idempotencyKey?: string): Task;
    acceptTask(taskId: string, escortId: string, idempotencyKey?: string): Task;
    transferTask(taskId: string, fromEscortId: string, toEscortId: string, reason: string, operator: string, idempotencyKey?: string): Task;
    completeTask(taskId: string, escortId: string, idempotencyKey?: string): Task;
    cancelTask(taskId: string, reason: string, operator: string, idempotencyKey?: string): Task;
    timeoutTask(taskId: string, idempotencyKey?: string): Task;
    getTaskById(taskId: string): Task | undefined;
    getTasksByStatus(status: TaskStatus): Task[];
    getTasksByEscort(escortId: string): Task[];
    getAllTasks(): Task[];
    getStatistics(startTime?: number, endTime?: number): TaskStats;
    cleanupExpiredIdempotencyRecords(): number;
}
export declare const taskService: TaskService;
