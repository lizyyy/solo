import { getDatabase } from '../db/database';
import { generateId, now } from '../utils';
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

export function createTask(options: CreateTaskOptions): string {
  const db = getDatabase();
  const taskId = generateId();

  const stmt = db.prepare(`
    INSERT INTO async_tasks (
      id, batch_id, task_type, status, retry_count, max_retries, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    taskId,
    options.batchId || null,
    options.taskType,
    TaskStatus.PENDING,
    0,
    options.maxRetries || 3,
    now(),
    now()
  );

  return taskId;
}

export function startTask(taskId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, updated_at = ? 
    WHERE id = ?
  `);
  stmt.run(TaskStatus.PROCESSING, now(), taskId);
}

export function completeTask(taskId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, processed_at = ?, updated_at = ? 
    WHERE id = ?
  `);
  stmt.run(TaskStatus.COMPLETED, now(), now(), taskId);
}

export function failTask(taskId: string, error: TaskError): TaskStatus {
  const db = getDatabase();
  
  const task = db.prepare(`
    SELECT retry_count, max_retries FROM async_tasks WHERE id = ?
  `).get(taskId) as { retry_count: number; max_retries: number };

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const newRetryCount = task.retry_count + 1;
  let newStatus: TaskStatus;

  if (newRetryCount >= task.max_retries) {
    newStatus = TaskStatus.PERMANENT_FAILED;
  } else if (error.message.includes('manual') || error.message.includes('人工')) {
    newStatus = TaskStatus.MANUAL;
  } else {
    newStatus = TaskStatus.RETRY;
  }

  const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, retry_count = ?, error_message = ?, error_stack = ?, updated_at = ? 
    WHERE id = ?
  `);

  stmt.run(
    newStatus,
    newRetryCount,
    error.message,
    error.stack || null,
    now(),
    taskId
  );

  return newStatus;
}

export function setManualTask(taskId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, updated_at = ? 
    WHERE id = ?
  `);
  stmt.run(TaskStatus.MANUAL, now(), taskId);
}

export function retryTask(taskId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, updated_at = ? 
    WHERE id = ?
  `);
  stmt.run(TaskStatus.PENDING, now(), taskId);
}

export function getTask(taskId: string): any {
  const db = getDatabase();
  return db.prepare('SELECT * FROM async_tasks WHERE id = ?').get(taskId);
}

export function getTasksByStatus(status: TaskStatus): any[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM async_tasks 
    WHERE status = ? 
    ORDER BY created_at ASC
  `).all(status);
}

export function getPendingTasks(): any[] {
  return getTasksByStatus(TaskStatus.PENDING);
}

export function getRetryTasks(): any[] {
  return getTasksByStatus(TaskStatus.RETRY);
}

export function getManualTasks(): any[] {
  return getTasksByStatus(TaskStatus.MANUAL);
}

export function getFailedTasks(): any[] {
  return getTasksByStatus(TaskStatus.PERMANENT_FAILED);
}

export function getTasksByBatch(batchId: string): any[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM async_tasks 
    WHERE batch_id = ? 
    ORDER BY created_at DESC
  `).all(batchId);
}

export function processPendingTasks(processor: (task: any) => Promise<void>): void {
  const pendingTasks = [...getPendingTasks(), ...getRetryTasks()];
  
  for (const task of pendingTasks) {
    startTask(task.id);
    processor(task)
      .then(() => completeTask(task.id))
      .catch((err) => failTask(task.id, { message: err.message, stack: err.stack }));
  }
}
