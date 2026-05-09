const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('./logger');
const { logAudit, OPERATIONS, ENTITY_TYPES } = require('./audit');

const TASK_TYPES = {
  GENERATE_REPORT: 'GENERATE_REPORT',
  SYNC_DATA: 'SYNC_DATA',
  SEND_NOTIFICATION: 'SEND_NOTIFICATION',
  RECALCULATE_SPLITS: 'RECALCULATE_SPLITS'
};

const TASK_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRY: 'retry'
};

const RETRY_DELAY_FN = (attempt) => {
  return Math.min(attempt * 1000 * 60, 60 * 60 * 1000);
};

const createTask = (taskType, payload, priority = 0, maxAttempts = 5) => {
  const now = Date.now();
  const taskId = uuidv4();
  
  db.prepare(`
    INSERT INTO task_queue (
      id, task_type, payload, status, priority, attempts, max_attempts, created_at
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    taskId,
    taskType,
    JSON.stringify(payload),
    TASK_STATUSES.PENDING,
    priority,
    maxAttempts,
    now
  );
  
  logger.info('Task created', { taskId, taskType });
  logAudit(OPERATIONS.CREATE, ENTITY_TYPES.TASK, taskId, null, { taskType, payload }, {});
  
  return taskId;
};

const getNextTask = () => {
  const now = Date.now();
  
  const task = db.prepare(`
    SELECT * FROM task_queue
    WHERE status IN (?, ?)
    AND (next_retry_at IS NULL OR next_retry_at <= ?)
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
  `).get(TASK_STATUSES.PENDING, TASK_STATUSES.RETRY, now);
  
  if (task) {
    db.prepare(`
      UPDATE task_queue SET 
        status = ?,
        last_attempted_at = ?,
        attempts = attempts + 1
      WHERE id = ?
    `).run(TASK_STATUSES.PROCESSING, now, task.id);
    
    return {
      ...task,
      payload: JSON.parse(task.payload)
    };
  }
  
  return null;
};

const completeTask = (taskId) => {
  db.prepare(`
    UPDATE task_queue SET 
      status = ?,
      last_attempted_at = ?
    WHERE id = ?
  `).run(TASK_STATUSES.COMPLETED, Date.now(), taskId);
  
  logger.info('Task completed', { taskId });
  logAudit(OPERATIONS.UPDATE, ENTITY_TYPES.TASK, taskId, null, { status: TASK_STATUSES.COMPLETED }, {});
};

const failTask = (taskId, errorMessage) => {
  const task = db.prepare('SELECT * FROM task_queue WHERE id = ?').get(taskId);
  
  if (!task) {
    return;
  }
  
  const willRetry = task.attempts < task.max_attempts;
  const newStatus = willRetry ? TASK_STATUSES.RETRY : TASK_STATUSES.FAILED;
  const nextRetryAt = willRetry ? Date.now() + RETRY_DELAY_FN(task.attempts + 1) : null;
  
  db.prepare(`
    UPDATE task_queue SET 
      status = ?,
      error_message = ?,
      last_attempted_at = ?,
      next_retry_at = ?
    WHERE id = ?
  `).run(
    newStatus,
    errorMessage,
    Date.now(),
    nextRetryAt,
    taskId
  );
  
  logger.warn('Task failed', { 
    taskId, 
    attempts: task.attempts + 1, 
    maxAttempts: task.max_attempts,
    willRetry,
    error: errorMessage 
  });
  
  logAudit(OPERATIONS.UPDATE, ENTITY_TYPES.TASK, taskId, null, { 
    status: newStatus, 
    errorMessage,
    willRetry 
  }, {});
};

const getTaskStatus = (taskId) => {
  const task = db.prepare('SELECT * FROM task_queue WHERE id = ?').get(taskId);
  
  if (!task) {
    return null;
  }
  
  return {
    ...task,
    payload: JSON.parse(task.payload)
  };
};

const getFailedTasks = (limit = 50) => {
  const tasks = db.prepare(`
    SELECT * FROM task_queue
    WHERE status = ?
    ORDER BY last_attempted_at DESC
    LIMIT ?
  `).all(TASK_STATUSES.FAILED, limit);
  
  return tasks.map(t => ({
    ...t,
    payload: JSON.parse(t.payload)
  }));
};

const retryFailedTask = (taskId) => {
  const task = db.prepare('SELECT * FROM task_queue WHERE id = ?').get(taskId);
  
  if (!task || task.status !== TASK_STATUSES.FAILED) {
    throw new Error('Task not found or not failed');
  }
  
  db.prepare(`
    UPDATE task_queue SET 
      status = ?,
      attempts = 0,
      error_message = NULL,
      next_retry_at = NULL
    WHERE id = ?
  `).run(TASK_STATUSES.PENDING, taskId);
  
  logger.info('Task queued for retry', { taskId });
  logAudit(OPERATIONS.UPDATE, ENTITY_TYPES.TASK, taskId, null, { status: TASK_STATUSES.PENDING, retry: true }, {});
  
  return true;
};

const cleanupCompletedTasks = (olderThanMs = 7 * 24 * 60 * 60 * 1000) => {
  const cutoff = Date.now() - olderThanMs;
  const result = db.prepare(`
    DELETE FROM task_queue 
    WHERE status = ? AND last_attempted_at < ?
  `).run(TASK_STATUSES.COMPLETED, cutoff);
  
  logger.info('Cleaned up completed tasks', { count: result.changes });
  return result.changes;
};

let processorInterval = null;

const taskHandlers = new Map();

const registerHandler = (taskType, handler) => {
  taskHandlers.set(taskType, handler);
};

const processNextTask = async () => {
  const task = getNextTask();
  
  if (!task) {
    return false;
  }
  
  const handler = taskHandlers.get(task.task_type);
  
  if (!handler) {
    logger.error('No handler registered for task type', { taskType: task.task_type });
    failTask(task.id, `No handler registered for task type: ${task.task_type}`);
    return true;
  }
  
  try {
    logger.info('Processing task', { taskId: task.id, taskType: task.task_type });
    await handler(task.payload);
    completeTask(task.id);
    return true;
  } catch (error) {
    failTask(task.id, error.message || String(error));
    return true;
  }
};

const startProcessor = (intervalMs = 5000) => {
  if (processorInterval) {
    return;
  }
  
  logger.info('Task processor started', { intervalMs });
  
  processorInterval = setInterval(async () => {
    try {
      let processed = 0;
      while (await processNextTask()) {
        processed++;
        if (processed >= 10) {
          break;
        }
      }
    } catch (error) {
      logger.error('Task processor error', { error: error.message });
    }
  }, intervalMs);
};

const stopProcessor = () => {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    logger.info('Task processor stopped');
  }
};

module.exports = {
  createTask,
  getNextTask,
  completeTask,
  failTask,
  getTaskStatus,
  getFailedTasks,
  retryFailedTask,
  cleanupCompletedTasks,
  registerHandler,
  startProcessor,
  stopProcessor,
  TASK_TYPES,
  TASK_STATUSES
};
