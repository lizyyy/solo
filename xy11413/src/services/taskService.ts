import { runQuery, runInsert, runUpdate } from '../database/connection';
import { TABLES } from '../database/schema';
import { TaskStatus, FailureCategory, VerificationTask } from '../types';
import { generateTaskId } from '../utils/factId';

interface TaskRecord {
  task_id: string;
  task_type: string;
  status: string;
  payload: string;
  retry_count: number;
  max_retries: number;
  failure_category?: string;
  failure_reason?: string;
  manual_opinion?: string;
  assigned_to?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export const createTask = async (
  taskType: string,
  payload: any,
  maxRetries: number = 3
): Promise<string> => {
  const taskId = generateTaskId();
  await runInsert(
    `INSERT INTO ${TABLES.VERIFICATION_TASKS} (
      task_id, task_type, status, payload, max_retries
    ) VALUES (?, ?, ?, ?, ?)`,
    [taskId, taskType, 'pending', JSON.stringify(payload), maxRetries]
  );
  return taskId;
};

export const getTaskById = async (taskId: string): Promise<VerificationTask | null> => {
  const records = await runQuery<TaskRecord>(
    `SELECT * FROM ${TABLES.VERIFICATION_TASKS} WHERE task_id = ?`,
    [taskId]
  );
  if (records.length === 0) return null;
  return mapToVerificationTask(records[0]);
};

export const getPendingTasks = async (): Promise<VerificationTask[]> => {
  const records = await runQuery<TaskRecord>(
    `SELECT * FROM ${TABLES.VERIFICATION_TASKS} 
     WHERE status IN ('pending', 'waiting_retry')
     ORDER BY created_at ASC`
  );
  return records.map(mapToVerificationTask);
};

export const getTasksByStatus = async (status: TaskStatus): Promise<VerificationTask[]> => {
  const records = await runQuery<TaskRecord>(
    `SELECT * FROM ${TABLES.VERIFICATION_TASKS} WHERE status = ? ORDER BY created_at DESC`,
    [status]
  );
  return records.map(mapToVerificationTask);
};

export const getAllTasks = async (): Promise<VerificationTask[]> => {
  const records = await runQuery<TaskRecord>(
    `SELECT * FROM ${TABLES.VERIFICATION_TASKS} ORDER BY created_at DESC`
  );
  return records.map(mapToVerificationTask);
};

export const startTask = async (taskId: string): Promise<boolean> => {
  const changes = await runUpdate(
    `UPDATE ${TABLES.VERIFICATION_TASKS} 
     SET status = 'processing', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ? AND status IN ('pending', 'waiting_retry')`,
    [taskId]
  );
  return changes > 0;
};

export const completeTask = async (taskId: string): Promise<boolean> => {
  const changes = await runUpdate(
    `UPDATE ${TABLES.VERIFICATION_TASKS} 
     SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ?`,
    [taskId]
  );
  return changes > 0;
};

export const failTask = async (
  taskId: string,
  failureReason: string,
  category: FailureCategory
): Promise<TaskStatus> => {
  const task = await getTaskById(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const newRetryCount = task.retryCount + 1;

  if (category === 'permanent') {
    await runUpdate(
      `UPDATE ${TABLES.VERIFICATION_TASKS} 
       SET status = 'permanent_failed', 
           failure_category = 'permanent',
           failure_reason = ?,
           retry_count = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE task_id = ?`,
      [failureReason, newRetryCount, taskId]
    );
    return 'permanent_failed';
  }

  if (category === 'needs_manual') {
    await runUpdate(
      `UPDATE ${TABLES.VERIFICATION_TASKS} 
       SET status = 'waiting_manual', 
           failure_category = 'needs_manual',
           failure_reason = ?,
           retry_count = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE task_id = ?`,
      [failureReason, newRetryCount, taskId]
    );
    return 'waiting_manual';
  }

  if (newRetryCount >= task.maxRetries) {
    await runUpdate(
      `UPDATE ${TABLES.VERIFICATION_TASKS} 
       SET status = 'permanent_failed', 
           failure_category = 'permanent',
           failure_reason = ?,
           retry_count = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE task_id = ?`,
      [`已达最大重试次数: ${failureReason}`, newRetryCount, taskId]
    );
    return 'permanent_failed';
  }

  await runUpdate(
    `UPDATE ${TABLES.VERIFICATION_TASKS} 
     SET status = 'waiting_retry', 
         failure_category = 'retryable',
         failure_reason = ?,
         retry_count = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ?`,
    [failureReason, newRetryCount, taskId]
  );
  return 'waiting_retry';
};

export const updateManualOpinion = async (
  taskId: string,
  opinion: string,
  resolved: boolean
): Promise<boolean> => {
  const status = resolved ? 'pending' : 'waiting_manual';
  const changes = await runUpdate(
    `UPDATE ${TABLES.VERIFICATION_TASKS} 
     SET manual_opinion = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ? AND status = 'waiting_manual'`,
    [opinion, status, taskId]
  );
  return changes > 0;
};

export const assignTask = async (taskId: string, assignedTo: string): Promise<boolean> => {
  const changes = await runUpdate(
    `UPDATE ${TABLES.VERIFICATION_TASKS} 
     SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
     WHERE task_id = ?`,
    [assignedTo, taskId]
  );
  return changes > 0;
};

export const resetProcessingTasks = async (): Promise<number> => {
  const changes = await runUpdate(
    `UPDATE ${TABLES.VERIFICATION_TASKS} 
     SET status = CASE 
       WHEN retry_count < max_retries THEN 'waiting_retry'
       ELSE 'permanent_failed'
     END,
     updated_at = CURRENT_TIMESTAMP
     WHERE status = 'processing'`
  );
  console.log(`已重置 ${changes} 个处理中的任务`);
  return changes;
};

const mapToVerificationTask = (record: TaskRecord): VerificationTask => ({
  taskId: record.task_id,
  taskType: record.task_type,
  status: record.status as TaskStatus,
  payload: record.payload,
  retryCount: record.retry_count,
  maxRetries: record.max_retries,
  failureCategory: record.failure_category as FailureCategory,
  failureReason: record.failure_reason,
  manualOpinion: record.manual_opinion,
  assignedTo: record.assigned_to,
  startedAt: record.started_at,
  completedAt: record.completed_at
});
