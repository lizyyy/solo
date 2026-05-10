const db = require('../db');
const config = require('../config');
const logger = require('./logger');

const TASK_TYPES = {
  FINGERPRINT_ANALYSIS: 'fingerprint_analysis',
  OPTIMIZATION_REVIEW: 'optimization_review',
  RERUN_SCHEDULE: 'rerun_schedule',
  WEEKLY_REPORT: 'weekly_report',
  ALERT_NOTIFICATION: 'alert_notification'
};

const TASK_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  RETRY: 'retry',
  FAILED: 'failed'
};

function queueTask(type, payload, priority = 0) {
  const task = db.insert('task_queue', {
    type,
    payload: JSON.stringify(payload),
    priority,
    status: TASK_STATUSES.PENDING,
    retry_count: 0,
    error_message: null,
    available_at: db.now(),
    locked_by: null,
    locked_at: null,
    completed_at: null
  });
  
  logger.info(`Task queued: ${type}`, { taskId: task.id, priority });
  return task.id;
}

function getPendingTasks() {
  return db.findAll('task_queue', t => t.status === 'pending' || t.status === 'retry')
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.created_at - b.created_at;
    });
}

function getTasks(limit = 100) {
  return db.findAll('task_queue')
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, limit);
}

function claimNextTask(workerId) {
  const now = db.now();
  const pending = db.findAll('task_queue', t => 
    (t.status === 'pending' || t.status === 'retry') && t.available_at <= now
  ).sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.created_at - b.created_at;
  });
  
  if (pending.length === 0) return null;
  
  const task = pending[0];
  
  const record = db.findById('task_queue', task.id);
  if (!record || ((record.status !== 'pending' && record.status !== 'retry'))) {
    return null;
  }
  
  db.update('task_queue', task.id, {
    status: TASK_STATUSES.PROCESSING,
    locked_by: workerId,
    locked_at: now
  });
  
  return {
    ...record,
    payload: JSON.parse(record.payload)
  };
}

function completeTask(taskId) {
  const task = db.findById('task_queue', taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  db.update('task_queue', taskId, {
    status: TASK_STATUSES.COMPLETED,
    completed_at: db.now()
  });
  
  logger.info(`Task completed: ${taskId}`);
  return true;
}

function failTask(taskId, error, canRetry = true) {
  const task = db.findById('task_queue', taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  const shouldRetry = canRetry && task.retry_count < config.task.maxRetries;
  const newStatus = shouldRetry ? TASK_STATUSES.RETRY : TASK_STATUSES.FAILED;
  const newAvailableAt = shouldRetry ? db.now() + Math.floor(config.task.retryDelay / 1000) : db.now();
  
  db.update('task_queue', taskId, {
    status: newStatus,
    error_message: error.message || error,
    retry_count: task.retry_count + 1,
    available_at: newAvailableAt
  });
  
  logger.warn(`Task ${taskId} ${newStatus}`, { 
    error: error.message || error,
    retryCount: task.retry_count + 1,
    maxRetries: config.task.maxRetries
  });
  
  return {
    status: newStatus,
    willRetry: shouldRetry
  };
}

module.exports = {
  TASK_TYPES,
  TASK_STATUSES,
  queueTask,
  getPendingTasks,
  getTasks,
  claimNextTask,
  completeTask,
  failTask
};
