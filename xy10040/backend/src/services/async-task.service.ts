import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/client';
import { logger } from '../utils/logger';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export interface AsyncTask {
  id: string;
  taskType: string;
  payload: Record<string, unknown>;
  status: TaskStatus;
  priority: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskHandler {
  taskType: string;
  handle: (payload: Record<string, unknown>) => Promise<void>;
}

export class AsyncTaskService {
  private handlers: Map<string, TaskHandler['handle']> = new Map();
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;

  registerHandler(handler: TaskHandler): void {
    this.handlers.set(handler.taskType, handler.handle);
    logger.info('Task handler registered', { taskType: handler.taskType });
  }

  async enqueue(
    taskType: string,
    payload: Record<string, unknown>,
    options: {
      priority?: number;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const taskId = uuidv4();
    const priority = options.priority ?? 0;
    const maxRetries = options.maxRetries ?? 3;

    await db.query(
      `INSERT INTO async_tasks (
        id, task_type, payload, status, priority, max_retries
      ) VALUES ($1, $2, $3, 'pending', $4, $5)`,
      [taskId, taskType, JSON.stringify(payload), priority, maxRetries]
    );

    logger.info('Task enqueued', { taskId, taskType, priority });
    return taskId;
  }

  async getTask(taskId: string): Promise<AsyncTask | null> {
    const result = await db.query(
      `SELECT * FROM async_tasks WHERE id = $1`,
      [taskId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTask(result.rows[0] as Record<string, unknown>);
  }

  private async acquireNextTask(): Promise<AsyncTask | null> {
    return db.transaction(async (client) => {
      await client.query(
        `DELETE FROM async_tasks 
         WHERE status = 'dead_letter' 
         AND updated_at < CURRENT_TIMESTAMP - INTERVAL '7 days'`
      );

      const result = await client.query(
        `SELECT * FROM async_tasks 
         WHERE status = 'pending'
         OR (status = 'failed' AND next_retry_at <= CURRENT_TIMESTAMP)
         ORDER BY priority DESC, created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`
      );

      if (result.rows.length === 0) {
        return null;
      }

      const task = this.mapRowToTask(result.rows[0] as Record<string, unknown>);

      await client.query(
        `UPDATE async_tasks 
         SET status = 'processing',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [task.id]
      );

      return task;
    });
  }

  private async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    errorMessage?: string
  ): Promise<void> {
    const updates: string[] = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [taskId, status];
    let paramIndex = 3;

    if (errorMessage) {
      updates.push(`error_message = $${paramIndex++}`);
      params.push(errorMessage);
    }

    if (status === 'failed') {
      updates.push(`retry_count = retry_count + 1`);
      updates.push(`next_retry_at = CURRENT_TIMESTAMP + (retry_count + 1) * INTERVAL '30 seconds'`);
    }

    if (status === 'completed') {
      updates.push(`error_message = NULL`);
    }

    await db.query(
      `UPDATE async_tasks SET ${updates.join(', ')} WHERE id = $1`,
      params
    );
  }

  private async moveToDeadLetter(taskId: string, errorMessage: string): Promise<void> {
    await db.query(
      `UPDATE async_tasks 
       SET status = 'dead_letter',
           error_message = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [taskId, errorMessage]
    );
    logger.error('Task moved to dead letter queue', { taskId, errorMessage });
  }

  private async processTask(task: AsyncTask): Promise<void> {
    const handler = this.handlers.get(task.taskType);

    if (!handler) {
      logger.error('No handler registered for task type', { taskType: task.taskType });
      await this.moveToDeadLetter(task.id, `No handler for task type: ${task.taskType}`);
      return;
    }

    try {
      logger.info('Processing task', { taskId: task.id, taskType: task.taskType });
      await handler(task.payload);
      await this.updateTaskStatus(task.id, 'completed');
      logger.info('Task completed', { taskId: task.id });
    } catch (error) {
      const errorMessage = (error as Error).message;
      logger.error('Task failed', {
        taskId: task.id,
        taskType: task.taskType,
        error: errorMessage,
        retryCount: task.retryCount,
        maxRetries: task.maxRetries,
      });

      if (task.retryCount >= task.maxRetries - 1) {
        await this.moveToDeadLetter(task.id, errorMessage);
      } else {
        await this.updateTaskStatus(task.id, 'failed', errorMessage);
        logger.info('Task scheduled for retry', {
          taskId: task.id,
          nextRetry: `in ${(task.retryCount + 1) * 30} seconds`,
        });
      }
    }
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const task = await this.acquireNextTask();
      if (task) {
        await this.processTask(task);
      }
    } catch (error) {
      logger.error('Task polling error', { error: (error as Error).message });
    }
  }

  start(pollIntervalMs: number = 1000): void {
    if (this.isRunning) {
      logger.warn('Task service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Async task service started', { pollIntervalMs });

    this.pollInterval = setInterval(() => {
      this.poll();
    }, pollIntervalMs);

    this.poll();
  }

  stop(): void {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    logger.info('Async task service stopped');
  }

  private mapRowToTask(row: Record<string, unknown>): AsyncTask {
    return {
      id: row.id as string,
      taskType: row.task_type as string,
      payload: row.payload as Record<string, unknown>,
      status: row.status as TaskStatus,
      priority: row.priority as number,
      retryCount: row.retry_count as number,
      maxRetries: row.max_retries as number,
      nextRetryAt: row.next_retry_at as Date | undefined,
      errorMessage: (row.error_message as string) || undefined,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date,
    };
  }
}

export const asyncTaskService = new AsyncTaskService();
