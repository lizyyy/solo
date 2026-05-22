const { v4: uuidv4 } = require('uuid');
const db = require('../database/store');
const { TASK_STATUS, FAIL_TYPES } = require('../utils/constants');

class TaskService {
  static createTask(taskType, relatedId, relatedType, payload = {}) {
    const task = {
      id: uuidv4(),
      task_type: taskType,
      related_id: relatedId,
      related_type: relatedType,
      status: TASK_STATUS.PENDING,
      fail_type: null,
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      payload: JSON.stringify(payload),
      result: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      handled_by: null,
      handled_at: null,
      handle_remark: null
    };
    db.insert('async_tasks', task);
    return task;
  }

  static getPendingTasks(limit = 100) {
    return db.query('async_tasks', 
      t => t.status === TASK_STATUS.PENDING
    ).slice(0, limit);
  }

  static getTasksByStatus(status) {
    return db.findAll('async_tasks', { status });
  }

  static getTaskById(taskId) {
    return db.findById('async_tasks', taskId);
  }

  static startTask(taskId) {
    return db.update('async_tasks', taskId, {
      status: TASK_STATUS.RUNNING,
      updated_at: new Date().toISOString()
    });
  }

  static completeTask(taskId, result) {
    return db.update('async_tasks', taskId, {
      status: TASK_STATUS.COMPLETED,
      result: JSON.stringify(result),
      updated_at: new Date().toISOString()
    });
  }

  static failTask(taskId, error, handler = null) {
    const task = db.findById('async_tasks', taskId);
    if (!task) return null;
    
    const newRetryCount = task.retry_count + 1;
    const errorMsg = error.message || String(error);
    
    const isRetryable = this.isRetryableError(errorMsg);
    let failType;
    let newStatus;
    
    if (isRetryable && newRetryCount < task.max_retries) {
      failType = FAIL_TYPES.WAITING_RETRY;
      newStatus = TASK_STATUS.FAILED;
    } else if (!isRetryable) {
      failType = FAIL_TYPES.WAITING_MANUAL;
      newStatus = TASK_STATUS.FAILED;
    } else {
      failType = FAIL_TYPES.PERMANENT;
      newStatus = TASK_STATUS.FAILED;
    }
    
    return db.update('async_tasks', taskId, {
      status: newStatus,
      fail_type: failType,
      retry_count: newRetryCount,
      last_error: errorMsg,
      updated_at: new Date().toISOString()
    });
  }

  static isRetryableError(errorMsg) {
    const retryableKeywords = [
      'timeout', 'network', 'connection', 'temporary',
      'busy', 'rate', 'limit', '500', '502', '503'
    ];
    return retryableKeywords.some(kw => 
      errorMsg.toLowerCase().includes(kw.toLowerCase())
    );
  }

  static retryTask(taskId, operator) {
    return db.update('async_tasks', taskId, {
      status: TASK_STATUS.PENDING,
      updated_at: new Date().toISOString()
    });
  }

  static markAsManualHandled(taskId, operator, remark = '') {
    return db.update('async_tasks', taskId, {
      status: TASK_STATUS.COMPLETED,
      handled_by: operator?.id || 'system',
      handled_at: new Date().toISOString(),
      handle_remark: remark + ' (人工处理)',
      updated_at: new Date().toISOString()
    });
  }

  static processTaskQueue(handlerFn, options = { limit: 10 }) {
    const tasks = this.getPendingTasks(options.limit);
    const results = { processed: 0, succeeded: 0, failed: 0, taskResults: [] };
    
    tasks.forEach(task => {
      try {
        this.startTask(task.id);
        const result = handlerFn(task);
        this.completeTask(task.id, result);
        results.succeeded++;
        results.taskResults.push({ taskId: task.id, status: 'succeeded' });
      } catch (err) {
        this.failTask(task.id, err);
        results.failed++;
        results.taskResults.push({ taskId: task.id, status: 'failed', error: err.message });
      }
      results.processed++;
    });
    
    return results;
  }

  static getTaskQueueStats() {
    const all = db.findAll('async_tasks');
    return {
      total: all.length,
      pending: all.filter(t => t.status === TASK_STATUS.PENDING).length,
      running: all.filter(t => t.status === TASK_STATUS.RUNNING).length,
      completed: all.filter(t => t.status === TASK_STATUS.COMPLETED).length,
      failed: all.filter(t => t.status === TASK_STATUS.FAILED).length,
      waiting_retry: all.filter(t => t.fail_type === FAIL_TYPES.WAITING_RETRY).length,
      waiting_manual: all.filter(t => t.fail_type === FAIL_TYPES.WAITING_MANUAL).length,
      permanent: all.filter(t => t.fail_type === FAIL_TYPES.PERMANENT).length
    };
  }

  static getFailedTasksSummary() {
    const failed = db.query('async_tasks', t => t.status === TASK_STATUS.FAILED);
    return {
      total: failed.length,
      by_fail_type: {
        waiting_retry: failed.filter(t => t.fail_type === FAIL_TYPES.WAITING_RETRY).length,
        waiting_manual: failed.filter(t => t.fail_type === FAIL_TYPES.WAITING_MANUAL).length,
        permanent: failed.filter(t => t.fail_type === FAIL_TYPES.PERMANENT).length
      },
      tasks: failed.slice(0, 50).map(t => ({
        id: t.id,
        task_type: t.task_type,
        related_type: t.related_type,
        fail_type: t.fail_type,
        last_error: t.last_error,
        retry_count: t.retry_count
      }))
    };
  }
}

module.exports = TaskService;
