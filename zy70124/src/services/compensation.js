const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { getDb, transaction } = require('../db');
const { restoreInventory, deductInventory } = require('./inventory');

const TASK_TYPES = {
  RESTORE_INVENTORY: 'restore_inventory',
  DEDUCT_INVENTORY: 'deduct_inventory',
  CANCEL_QUEUE: 'cancel_queue',
  PROCESS_QUEUE: 'process_queue',
  UPDATE_ORDER_STATUS: 'update_order_status'
};

function createTask(type, referenceId, data = {}, maxRetries = null) {
  const db = getDb();
  const taskId = uuidv4();
  const nextRetryAt = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO compensation_tasks (
      id, type, reference_id, data, status,
      retry_count, max_retries, next_retry_at
    ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)
  `).run(
    taskId,
    type,
    referenceId,
    JSON.stringify(data),
    maxRetries || config.compensation.maxRetries,
    nextRetryAt
  );

  return taskId;
}

function getPendingTasks(limit = 10) {
  const db = getDb();
  const now = new Date().toISOString();
  
  return db.prepare(`
    SELECT * FROM compensation_tasks
    WHERE status IN ('pending', 'retrying')
      AND next_retry_at <= ?
    ORDER BY created_at ASC
    LIMIT ?
  `).all(now, limit);
}

function updateTaskStatus(taskId, status, error = null) {
  const db = getDb();
  const now = new Date().toISOString();
  
  const task = db.prepare(`
    SELECT * FROM compensation_tasks WHERE id = ?
  `).get(taskId);

  if (!task) return false;

  let nextRetryAt = null;
  if (status === 'retrying') {
    const delay = config.compensation.retryDelayMs * (task.retry_count + 1);
    nextRetryAt = new Date(Date.now() + delay).toISOString();
  }

  db.prepare(`
    UPDATE compensation_tasks
    SET status = ?,
        retry_count = CASE WHEN ? IN ('retrying', 'failed') THEN retry_count + 1 ELSE retry_count END,
        last_error = ?,
        next_retry_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    status,
    status,
    error ? error.message || error : null,
    nextRetryAt,
    now,
    taskId
  );

  return true;
}

function executeTask(task) {
  const data = JSON.parse(task.data || '{}');
  
  switch (task.type) {
    case TASK_TYPES.RESTORE_INVENTORY:
      restoreInventory(data.tierId, data.quantity);
      return { success: true, message: `已回补库存: 票档 ${data.tierId} +${data.quantity} 张` };

    case TASK_TYPES.DEDUCT_INVENTORY:
      deductInventory(data.tierId, data.quantity);
      return { success: true, message: `已扣减库存: 票档 ${data.tierId} -${data.quantity} 张` };

    case TASK_TYPES.UPDATE_ORDER_STATUS:
      const db = getDb();
      db.prepare(`
        UPDATE orders SET status = ?, fail_reason = ? WHERE id = ?
      `).run(data.status, data.reason || null, task.reference_id);
      return { success: true, message: `已更新订单 ${task.reference_id} 状态为 ${data.status}` };

    default:
      return { success: true, message: `任务类型 ${task.type} 无需处理` };
  }
}

function runCompensation(limit = 10) {
  const tasks = getPendingTasks(limit);
  const results = [];

  for (const task of tasks) {
    try {
      const result = executeTask(task);
      updateTaskStatus(task.id, 'success');
      results.push({
        taskId: task.id,
        type: task.type,
        status: 'completed',
        message: result.message
      });
    } catch (error) {
      const shouldRetry = (task.retry_count + 1) < task.max_retries;
      const newStatus = shouldRetry ? 'retrying' : 'failed';
      
      updateTaskStatus(task.id, newStatus, error);
      
      results.push({
        taskId: task.id,
        type: task.type,
        status: newStatus,
        retryCount: task.retry_count + 1,
        maxRetries: task.max_retries,
        error: error.message,
        message: shouldRetry 
          ? `执行失败，将在 ${Math.round(config.compensation.retryDelayMs * (task.retry_count + 1) / 60000)} 分钟后重试`
          : '已达最大重试次数，需人工介入'
      });
    }
  }

  return {
    processed: results.length,
    results
  };
}

function listTasks(status = null, limit = 50) {
  const db = getDb();
  
  if (status) {
    return db.prepare(`
      SELECT * FROM compensation_tasks
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(status, limit);
  }
  
  return db.prepare(`
    SELECT * FROM compensation_tasks
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

function getTask(taskId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM compensation_tasks WHERE id = ?`).get(taskId);
}

function retryTask(taskId) {
  const db = getDb();
  const task = getTask(taskId);
  
  if (!task) {
    return { success: false, message: '任务不存在' };
  }

  if (task.status === 'success') {
    return { success: false, message: '任务已成功，无需重试' };
  }

  db.prepare(`
    UPDATE compensation_tasks
    SET status = 'pending',
        retry_count = 0,
        last_error = NULL,
        next_retry_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), taskId);

  return { success: true, message: '已重置任务，等待下次补偿执行' };
}

function createInventoryRestoreTask(tierId, quantity, orderId) {
  return createTask(
    TASK_TYPES.RESTORE_INVENTORY,
    orderId,
    { tierId, quantity }
  );
}

function createOrderStatusTask(orderId, status, reason = null) {
  return createTask(
    TASK_TYPES.UPDATE_ORDER_STATUS,
    orderId,
    { status, reason }
  );
}

module.exports = {
  TASK_TYPES,
  createTask,
  getPendingTasks,
  updateTaskStatus,
  executeTask,
  runCompensation,
  listTasks,
  getTask,
  retryTask,
  createInventoryRestoreTask,
  createOrderStatusTask
};
