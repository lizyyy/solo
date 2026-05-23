const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { getDatabase } = require('../database');
const config = require('../config');

const TABLE_NAME = 'async_tasks';

function createTask(taskType, payload, options = {}) {
  const db = getDatabase();
  
  const task = {
    id: uuidv4(),
    task_type: taskType,
    payload: JSON.stringify(payload),
    status: config.taskStatus.PENDING,
    priority: options.priority || 0,
    retry_count: 0,
    max_retries: options.max_retries || 3,
    fail_reason: null,
    fail_type: null,
    handler_id: null,
    handler_name: null,
    batch_id: options.batch_id || null,
    scheduled_at: options.scheduled_at ? dayjs(options.scheduled_at).valueOf() : null,
    started_at: null,
    completed_at: null,
    created_at: dayjs().valueOf(),
    updated_at: dayjs().valueOf(),
  };

  const stmt = db.prepare(`
    INSERT INTO async_tasks (
      id, task_type, payload, status, priority, retry_count, max_retries,
      fail_reason, fail_type, handler_id, handler_name, batch_id,
      scheduled_at, started_at, completed_at, created_at, updated_at
    ) VALUES (
      @id, @task_type, @payload, @status, @priority, @retry_count, @max_retries,
      @fail_reason, @fail_type, @handler_id, @handler_name, @batch_id,
      @scheduled_at, @started_at, @completed_at, @created_at, @updated_at
    )
  `);

  stmt.run(task);
  
  return task;
}

function getNextTask(handlerId, handlerName, taskTypes = null) {
  const db = getDatabase();
  
  const now = dayjs().valueOf();
  let sql = `
    SELECT * FROM async_tasks 
    WHERE status IN (?, ?)
      AND (scheduled_at IS NULL OR scheduled_at <= ?)
  `;
  const params = [config.taskStatus.PENDING, config.taskStatus.RETRY, now];

  if (taskTypes && taskTypes.length > 0) {
    sql += ` AND task_type IN (${taskTypes.map(() => '?').join(',')})`;
    params.push(...taskTypes);
  }

  sql += ` ORDER BY priority DESC, created_at ASC LIMIT 1`;

  const stmt = db.prepare(sql);
  const task = stmt.get(...params);

  if (task) {
    const updateStmt = db.prepare(`
      UPDATE async_tasks 
      SET status = ?, started_at = ?, handler_id = ?, handler_name = ?, updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(config.taskStatus.PROCESSING, now, handlerId, handlerName, now, task.id);
    
    task.payload = JSON.parse(task.payload);
    return task;
  }

  return null;
}

function completeTask(taskId, result = null) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, completed_at = ?, updated_at = ?, payload = ?
    WHERE id = ?
  `);

  const task = getTaskById(taskId);
  const payload = task.payload;
  payload.result = result;

  stmt.run(config.taskStatus.COMPLETED, dayjs().valueOf(), dayjs().valueOf(), JSON.stringify(payload), taskId);
}

function failTask(taskId, failReason, failType = 'retry') {
  const db = getDatabase();
  
  const task = getTaskById(taskId);
  const newRetryCount = task.retry_count + 1;
  
  let newStatus;
  if (failType === 'manual') {
    newStatus = config.taskStatus.MANUAL;
  } else if (failType === 'permanent') {
    newStatus = config.taskStatus.FAILED;
  } else if (newRetryCount >= task.max_retries) {
    newStatus = config.taskStatus.MANUAL;
  } else {
    newStatus = config.taskStatus.RETRY;
  }

  const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, retry_count = ?, fail_reason = ?, fail_type = ?, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(newStatus, newRetryCount, failReason, failType, dayjs().valueOf(), taskId);

  return {
    newStatus,
    retryCount: newRetryCount,
    maxRetries: task.max_retries,
  };
}

function retryTask(taskId) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    UPDATE async_tasks 
    SET status = ?, updated_at = ?
    WHERE id = ? AND status = ?
  `);

  const result = stmt.run(config.taskStatus.RETRY, dayjs().valueOf(), taskId, config.taskStatus.MANUAL);
  
  return result.changes > 0;
}

function getTaskById(taskId) {
  const db = getDatabase();
  
  const stmt = db.prepare('SELECT * FROM async_tasks WHERE id = ?');
  const task = stmt.get(taskId);
  
  if (task) {
    task.payload = JSON.parse(task.payload);
    task.created_at = dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss');
    task.updated_at = dayjs(task.updated_at).format('YYYY-MM-DD HH:mm:ss');
    task.started_at = task.started_at ? dayjs(task.started_at).format('YYYY-MM-DD HH:mm:ss') : null;
    task.completed_at = task.completed_at ? dayjs(task.completed_at).format('YYYY-MM-DD HH:mm:ss') : null;
  }
  
  return task;
}

function getTaskList(filters = {}) {
  const db = getDatabase();
  let sql = 'SELECT * FROM async_tasks WHERE 1=1';
  const params = [];

  if (filters.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.task_type) {
    sql += ' AND task_type = ?';
    params.push(filters.task_type);
  }
  if (filters.batch_id) {
    sql += ' AND batch_id = ?';
    params.push(filters.batch_id);
  }
  if (filters.handler_id) {
    sql += ' AND handler_id = ?';
    params.push(filters.handler_id);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(filters.limit || 50, filters.offset || 0);

  const stmt = db.prepare(sql);
  const tasks = stmt.all(...params);

  return tasks.map(task => ({
    ...task,
    payload: JSON.parse(task.payload),
    created_at: dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss'),
    updated_at: dayjs(task.updated_at).format('YYYY-MM-DD HH:mm:ss'),
  }));
}

function getFailedTasks() {
  return getTaskList({ status: config.taskStatus.MANUAL });
}

module.exports = {
  createTask,
  getNextTask,
  completeTask,
  failTask,
  retryTask,
  getTaskById,
  getTaskList,
  getFailedTasks,
  TABLE_NAME,
};
