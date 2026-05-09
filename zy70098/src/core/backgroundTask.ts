import { BackgroundTask } from '../types';
import { v4 as uuidv4 } from 'uuid';

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

export const DEFAULT_QUEUE_CONFIG: TaskQueueConfig = {
  maxConcurrent: 5,
  retryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  backoffMultiplier: 2
};

export class TaskQueue {
  private config: TaskQueueConfig;
  private pendingTasks: Map<string, BackgroundTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private handlers: Map<string, TaskHandler> = new Map();
  private taskResults: Map<string, {
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
    completedAt: Date;
  }> = new Map();

  constructor(config: Partial<TaskQueueConfig> = {}) {
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
  }

  registerHandler(handler: TaskHandler): void {
    this.handlers.set(handler.type, handler);
  }

  createTask(
    type: 'deviation_calculation' | 'settlement',
    batchId: string,
    payload: Record<string, unknown>,
    options: { enrollmentId?: string; priority?: number; maxAttempts?: number } = {}
  ): BackgroundTask {
    const task: BackgroundTask = {
      id: uuidv4(),
      type,
      batchId,
      enrollmentId: options.enrollmentId,
      status: 'pending',
      priority: options.priority || 100,
      payload,
      attemptCount: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: new Date()
    };

    this.pendingTasks.set(task.id, task);
    this.scheduleExecution();
    return task;
  }

  getTaskStatus(taskId: string): BackgroundTask | undefined {
    const pending = this.pendingTasks.get(taskId);
    if (pending) return pending;

    if (this.runningTasks.has(taskId)) {
      return { id: taskId, type: 'deviation_calculation', batchId: '', status: 'running', priority: 0, payload: {}, attemptCount: 0, maxAttempts: 0, createdAt: new Date() };
    }

    return undefined;
  }

  getTaskResult(taskId: string): {
    success: boolean;
    result?: Record<string, unknown>;
    error?: string;
    completedAt: Date;
  } | undefined {
    return this.taskResults.get(taskId);
  }

  private scheduleExecution(): void {
    const availableSlots = this.config.maxConcurrent - this.runningTasks.size;
    if (availableSlots <= 0) return;

    const sortedTasks = Array.from(this.pendingTasks.values())
      .filter(t => t.status === 'pending')
      .sort((a, b) => b.priority - a.priority);

    for (let i = 0; i < Math.min(availableSlots, sortedTasks.length); i++) {
      this.executeTask(sortedTasks[i]);
    }
  }

  private async executeTask(task: BackgroundTask): Promise<void> {
    const handler = this.handlers.get(task.type);
    if (!handler) {
      this.handleTaskFailure(task, `未找到类型为 ${task.type} 的处理器`);
      return;
    }

    this.runningTasks.add(task.id);
    this.pendingTasks.delete(task.id);

    const updatedTask: BackgroundTask = {
      ...task,
      status: 'running',
      attemptCount: task.attemptCount + 1,
      runAt: new Date()
    };

    try {
      const result = await handler.execute({
        task: updatedTask,
        progress: () => {},
        shouldCancel: () => false
      });

      if (result.success) {
        this.handleTaskSuccess(task, result.result);
      } else {
        this.handleTaskFailure(task, result.error || '任务执行失败');
      }
    } catch (error) {
      this.handleTaskFailure(task, error instanceof Error ? error.message : '未知错误');
    }
  }

  private handleTaskSuccess(
    task: BackgroundTask,
    result?: Record<string, unknown>
  ): void {
    this.runningTasks.delete(task.id);
    this.taskResults.set(task.id, {
      success: true,
      result,
      completedAt: new Date()
    });
    this.scheduleExecution();
  }

  private handleTaskFailure(task: BackgroundTask, error: string): void {
    this.runningTasks.delete(task.id);

    if (task.attemptCount < task.maxAttempts) {
      const updatedTask: BackgroundTask = {
        ...task,
        status: 'pending',
        lastError: error
      };
      this.pendingTasks.set(task.id, updatedTask);

      const delay = Math.min(
        this.config.retryDelayMs * Math.pow(this.config.backoffMultiplier, task.attemptCount),
        this.config.maxRetryDelayMs
      );

      setTimeout(() => this.scheduleExecution(), delay);
    } else {
      this.taskResults.set(task.id, {
        success: false,
        error,
        completedAt: new Date()
      });
    }

    this.scheduleExecution();
  }

  getPendingTasks(): BackgroundTask[] {
    return Array.from(this.pendingTasks.values());
  }

  getTaskStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } {
    const results = Array.from(this.taskResults.values());
    return {
      pending: this.pendingTasks.size,
      running: this.runningTasks.size,
      completed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }
}

export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  multiplier: number = 2
): number {
  return Math.min(baseDelayMs * Math.pow(multiplier, attempt), maxDelayMs);
}

export function shouldRetry(
  attemptCount: number,
  maxAttempts: number
): boolean {
  return attemptCount < maxAttempts;
}
