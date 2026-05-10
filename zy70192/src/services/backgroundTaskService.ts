import { v4 as uuidv4 } from 'uuid';
import db from '../config/database';
import { BackgroundTask, BackgroundTaskType, BackgroundTaskStatus } from '../types';
import { AppError, errorCodes } from '../utils/response';
import { exportSampleReportCSV, getSystemOverview } from './exportService';

const TASK_INTERVAL = 5000;
const RETRY_DELAY = 30000;
let taskQueueRunning = false;
let taskInterval: NodeJS.Timeout | null = null;

const taskHandlers: Record<BackgroundTaskType, (payload: Record<string, any>) => Promise<Record<string, any>>> = {
  GENERATE_REPORT: async (payload: any) => {
    if (!payload.sampleId) {
      throw new Error('缺少 sampleId 参数');
    }
    const csv = exportSampleReportCSV(payload.sampleId);
    return { 
      sampleId: payload.sampleId,
      csv,
      fileName: `sample-report-${payload.sampleId}-${Date.now()}.csv`
    };
  },
  SEND_NOTIFICATION: async (payload: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      recipient: payload.recipient,
      message: payload.message,
      sentAt: new Date().toISOString()
    };
  },
  EXPORT_DATA: async (payload: any) => {
    const overview = getSystemOverview();
    return {
      exportType: payload.exportType || 'overview',
      data: overview,
      exportedAt: new Date().toISOString()
    };
  },
  BATCH_UPDATE: async (payload: any) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      updatedCount: payload.ids?.length || 0,
      completedAt: new Date().toISOString()
    };
  },
  SYNC_DATA: async (payload: any) => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      syncedFrom: payload.source || 'external',
      recordCount: payload.count || 0,
      syncedAt: new Date().toISOString()
    };
  }
};

export const createBackgroundTask = (
  taskType: BackgroundTaskType,
  payload: Record<string, any>,
  maxRetries: number = 3
): BackgroundTask => {
  const now = new Date().toISOString();
  
  const task: BackgroundTask = {
    id: uuidv4(),
    taskType,
    status: 'PENDING',
    payload,
    retryCount: 0,
    maxRetries,
    createdAt: now
  };

  const stmt = db.prepare(`
    INSERT INTO background_tasks (id, task_type, status, payload, retry_count, max_retries, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    task.id,
    task.taskType,
    task.status,
    JSON.stringify(task.payload),
    task.retryCount,
    task.maxRetries,
    task.createdAt
  );

  return task;
};

export const getBackgroundTaskById = (id: string): BackgroundTask => {
  const row = db.prepare(`SELECT * FROM background_tasks WHERE id = ?`).get(id) as any;
  if (!row) {
    throw new AppError(`后台任务 ${id} 不存在`, errorCodes.NOT_FOUND, 404);
  }
  return mapToBackgroundTask(row);
};

export const listBackgroundTasks = (
  params: {
    status?: BackgroundTaskStatus;
    taskType?: BackgroundTaskType;
  } = {},
  page: number = 1,
  pageSize: number = 20
): { items: BackgroundTask[], total: number } => {
  let query = `SELECT * FROM background_tasks WHERE 1=1`;
  const countQuery = `SELECT COUNT(*) as total FROM background_tasks WHERE 1=1`;
  const whereConditions: string[] = [];
  const queryParams: any[] = [];

  if (params.status) {
    whereConditions.push(`status = ?`);
    queryParams.push(params.status);
  }
  if (params.taskType) {
    whereConditions.push(`task_type = ?`);
    queryParams.push(params.taskType);
  }

  if (whereConditions.length > 0) {
    query += ` AND ${whereConditions.join(' AND ')}`;
  }

  const countStmt = db.prepare(
    whereConditions.length > 0 
      ? `${countQuery} AND ${whereConditions.join(' AND ')}`
      : countQuery
  );
  const countResult = countStmt.get(...queryParams) as { total: number };
  const total = countResult.total;

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const paginationParams = [...queryParams, pageSize, (page - 1) * pageSize];

  const rows = db.prepare(query).all(...paginationParams) as any[];

  return {
    items: rows.map(mapToBackgroundTask),
    total
  };
};

export const retryBackgroundTask = (id: string): BackgroundTask => {
  const task = getBackgroundTaskById(id);

  if (task.status === 'RUNNING') {
    throw new AppError('任务正在执行中，无法重试', errorCodes.BAD_REQUEST, 400);
  }

  if (task.status === 'COMPLETED') {
    throw new AppError('任务已完成，无需重试', errorCodes.BAD_REQUEST, 400);
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE background_tasks
    SET status = 'PENDING', retry_count = 0, error_message = NULL, error_stack = NULL, next_retry_at = NULL, started_at = NULL, completed_at = NULL
    WHERE id = ?
  `).run(id);

  return getBackgroundTaskById(id);
};

export const cancelBackgroundTask = (id: string): BackgroundTask => {
  const task = getBackgroundTaskById(id);

  if (task.status === 'RUNNING') {
    throw new AppError('任务正在执行中，无法取消', errorCodes.BAD_REQUEST, 400);
  }

  if (task.status === 'COMPLETED') {
    throw new AppError('任务已完成，无法取消', errorCodes.BAD_REQUEST, 400);
  }

  db.prepare(`
    UPDATE background_tasks
    SET status = 'CANCELLED'
    WHERE id = ?
  `).run(id);

  return getBackgroundTaskById(id);
};

const executeTask = async (task: BackgroundTask): Promise<void> => {
  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE background_tasks
    SET status = 'RUNNING', started_at = ?, retry_count = retry_count + 1
    WHERE id = ?
  `).run(now, task.id);

  try {
    const handler = taskHandlers[task.taskType];
    if (!handler) {
      throw new Error(`未知的任务类型: ${task.taskType}`);
    }

    const result = await handler(task.payload);

    const completedAt = new Date().toISOString();
    db.prepare(`
      UPDATE background_tasks
      SET status = 'COMPLETED', result = ?, completed_at = ?, error_message = NULL, error_stack = NULL, next_retry_at = NULL
      WHERE id = ?
    `).run(JSON.stringify(result), completedAt, task.id);

    console.log(`Task ${task.id} completed successfully`);

  } catch (error: any) {
    const failedAt = new Date().toISOString();
    const retryCount = task.retryCount + 1;
    
    let newStatus: BackgroundTaskStatus = 'FAILED';
    let nextRetryAt: string | null = null;

    if (retryCount < task.maxRetries) {
      newStatus = 'RETRYING';
      nextRetryAt = new Date(Date.now() + RETRY_DELAY).toISOString();
    }

    db.prepare(`
      UPDATE background_tasks
      SET status = ?, error_message = ?, error_stack = ?, next_retry_at = ?, completed_at = ?
      WHERE id = ?
    `).run(
      newStatus,
      error.message,
      error.stack,
      nextRetryAt,
      newStatus === 'FAILED' ? failedAt : null,
      task.id
    );

    console.log(`Task ${task.id} ${newStatus}: ${error.message}`);
  }
};

const getPendingTasks = (): BackgroundTask[] => {
  const now = new Date().toISOString();
  
  const rows = db.prepare(`
    SELECT * FROM background_tasks
    WHERE status = 'PENDING'
      OR (status = 'RETRYING' AND next_retry_at <= ?)
    ORDER BY created_at ASC
    LIMIT 10
  `).all(now) as any[];

  return rows.map(mapToBackgroundTask);
};

const processTasks = async (): Promise<void> => {
  if (!taskQueueRunning) return;

  const tasks = getPendingTasks();
  
  for (const task of tasks) {
    if (!taskQueueRunning) break;
    
    try {
      await executeTask(task);
    } catch (error) {
      console.error(`Error processing task ${task.id}:`, error);
    }
  }
};

export const startTaskQueue = (): void => {
  if (taskQueueRunning) {
    console.log('Task queue is already running');
    return;
  }

  taskQueueRunning = true;
  console.log('Task queue started');

  processTasks();
  
  taskInterval = setInterval(() => {
    if (taskQueueRunning) {
      processTasks();
    }
  }, TASK_INTERVAL);
};

export const stopTaskQueue = (): void => {
  if (!taskQueueRunning) {
    console.log('Task queue is not running');
    return;
  }

  taskQueueRunning = false;
  
  if (taskInterval) {
    clearInterval(taskInterval);
    taskInterval = null;
  }
  
  console.log('Task queue stopped');
};

export const getTaskQueueStatus = (): {
  running: boolean;
  intervalMs: number;
  retryDelayMs: number;
} => ({
  running: taskQueueRunning,
  intervalMs: TASK_INTERVAL,
  retryDelayMs: RETRY_DELAY
});

const mapToBackgroundTask = (row: any): BackgroundTask => ({
  id: row.id,
  taskType: row.task_type as BackgroundTaskType,
  status: row.status as BackgroundTaskStatus,
  payload: JSON.parse(row.payload),
  result: row.result ? JSON.parse(row.result) : undefined,
  errorMessage: row.error_message,
  errorStack: row.error_stack,
  retryCount: row.retry_count,
  maxRetries: row.max_retries,
  createdAt: row.created_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  nextRetryAt: row.next_retry_at
});
