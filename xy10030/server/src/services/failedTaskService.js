import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/index.js';
import { logOperation } from './operationLogService.js';
import { config } from '../config/index.js';

export function createFailedTask(params) {
  const { taskType, entityType, entityId, data, errorMessage, maxRetries = config.maxRetries } = params;
  
  const taskId = uuidv4();
  
  const stmt = db.prepare(`
    INSERT INTO failed_tasks (id, task_type, entity_type, entity_id, data, error_message, max_retries)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    taskId,
    taskType,
    entityType || null,
    entityId || null,
    JSON.stringify(data),
    errorMessage,
    maxRetries
  );
  
  logOperation({
    entityType: 'task',
    entityId: taskId,
    action: 'create',
    reason: '任务失败加入重试队列',
    status: 'success'
  });
  
  return taskId;
}

export function getFailedTasks(filters = {}) {
  const { status, limit = 100, offset = 0 } = filters;
  
  let whereClause = [];
  let params = [];
  
  if (status) {
    whereClause.push('status = ?');
    params.push(status);
  }
  
  const where = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';
  
  const tasks = db.prepare(`
    SELECT id, task_type, entity_type, entity_id, data, error_message, retry_count, max_retries, status, last_retry_at, created_at
    FROM failed_tasks
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);
  
  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM failed_tasks
    ${where}
  `).get(...params);
  
  return {
    tasks: tasks.map(task => ({
      ...task,
      data: JSON.parse(task.data)
    })),
    total: total.count
  };
}

export function getFailedTaskById(taskId) {
  const task = db.prepare(`
    SELECT id, task_type, entity_type, entity_id, data, error_message, retry_count, max_retries, status, last_retry_at, created_at
    FROM failed_tasks
    WHERE id = ?
  `).get(taskId);
  
  if (!task) return null;
  
  return {
    ...task,
    data: JSON.parse(task.data)
  };
}

export async function retryTask(taskId) {
  const task = getFailedTaskById(taskId);
  if (!task) {
    return { success: false, message: '任务不存在' };
  }
  
  if (task.status === 'completed') {
    return { success: false, message: '任务已完成' };
  }
  
  if (task.retry_count >= task.max_retries) {
    db.prepare(`
      UPDATE failed_tasks
      SET status = 'failed', last_retry_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(taskId);
    
    logOperation({
      entityType: 'task',
      entityId: taskId,
      action: 'retry',
      reason: '达到最大重试次数',
      status: 'failed'
    });
    
    return { success: false, message: '达到最大重试次数' };
  }
  
  db.prepare(`
    UPDATE failed_tasks
    SET status = 'retrying', retry_count = retry_count + 1, last_retry_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(taskId);
  
  try {
    const result = await executeTask(task);
    
    if (result.success) {
      db.prepare(`
        UPDATE failed_tasks
        SET status = 'completed', last_retry_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(taskId);
      
      logOperation({
        entityType: 'task',
        entityId: taskId,
        action: 'retry',
        reason: '重试成功',
        newData: result.data,
        status: 'success'
      });
      
      return { success: true, data: result.data };
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    db.prepare(`
      UPDATE failed_tasks
      SET status = 'pending', error_message = ?
      WHERE id = ?
    `).run(error.message, taskId);
    
    logOperation({
      entityType: 'task',
      entityId: taskId,
      action: 'retry',
      reason: error.message,
      status: 'failed'
    });
    
    return { success: false, message: error.message };
  }
}

async function executeTask(task) {
  switch (task.task_type) {
    case 'confirm_registration':
      return executeConfirmRegistration(task);
    case 'cancel_registration':
      return executeCancelRegistration(task);
    default:
      return { success: false, message: `未知任务类型: ${task.taskType}` };
  }
}

async function executeConfirmRegistration(task) {
  const { registrationId } = task.data;
  
  const registration = db.prepare(`
    SELECT * FROM registrations WHERE id = ?
  `).get(registrationId);
  
  if (!registration) {
    return { success: false, message: '报名记录不存在' };
  }
  
  if (registration.status === 'confirmed') {
    return { success: true, data: registration };
  }
  
  const event = db.prepare(`
    SELECT * FROM events WHERE id = ?
  `).get(registration.event_id);
  
  if (!event) {
    return { success: false, message: '活动不存在' };
  }
  
  if (event.status !== 'published') {
    return { success: false, message: '活动未发布' };
  }
  
  if (event.current_count >= event.capacity && event.capacity > 0) {
    return { success: false, message: '活动已满员' };
  }
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE registrations
      SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(registrationId);
    
    db.prepare(`
      UPDATE events
      SET current_count = current_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(registration.event_id);
  });
  
  tx();
  
  return { success: true, data: getRegistrationById(registrationId) };
}

async function executeCancelRegistration(task) {
  const { registrationId, reason } = task.data;
  
  const registration = db.prepare(`
    SELECT * FROM registrations WHERE id = ?
  `).get(registrationId);
  
  if (!registration) {
    return { success: false, message: '报名记录不存在' };
  }
  
  if (registration.status === 'cancelled') {
    return { success: true, data: registration };
  }
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE registrations
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(registrationId);
    
    if (registration.status === 'confirmed') {
      db.prepare(`
        UPDATE events
        SET current_count = MAX(0, current_count - 1), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(registration.event_id);
    }
  });
  
  tx();
  
  logOperation({
    entityType: 'registration',
    entityId: registrationId,
    action: 'cancel',
    oldData: registration,
    reason: reason || '任务重试取消',
    status: 'success'
  });
  
  return { success: true, data: getRegistrationById(registrationId) };
}

function getRegistrationById(id) {
  return db.prepare(`
    SELECT id, event_id, name, phone, email, status, version, created_at, updated_at
    FROM registrations
    WHERE id = ?
  `).get(id);
}

export function retryAllPendingTasks() {
  const { tasks } = getFailedTasks({ status: 'pending' });
  
  return Promise.all(tasks.map(task => retryTask(task.id)));
}
