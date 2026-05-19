const taskService = require('./taskService');
const { recordAudit } = require('../middleware/audit');

function batchCreate(tasksData, operator, role) {
  const results = {
    success: [],
    failed: [],
    summary: {
      total: tasksData.length,
      success_count: 0,
      failed_count: 0
    }
  };

  for (let i = 0; i < tasksData.length; i++) {
    try {
      const result = taskService.createTask(tasksData[i], operator, role);
      results.success.push({
        index: i,
        data: tasksData[i],
        result
      });
      results.summary.success_count++;
    } catch (error) {
      results.failed.push({
        index: i,
        data: tasksData[i],
        error: error.message,
        error_type: 'VALIDATION_ERROR',
        retryable: true
      });
      results.summary.failed_count++;
    }
  }

  return results;
}

function batchAccept(taskIds, operator, role) {
  const results = {
    success: [],
    failed: [],
    summary: {
      total: taskIds.length,
      success_count: 0,
      failed_count: 0
    }
  };

  for (let i = 0; i < taskIds.length; i++) {
    const taskId = taskIds[i];
    try {
      const result = taskService.acceptTask(taskId, operator, role);
      results.success.push({
        index: i,
        task_id: taskId,
        result
      });
      results.summary.success_count++;
    } catch (error) {
      const errorType = error.message.includes('不存在') ? 'NOT_FOUND' : 'STATUS_ERROR';
      results.failed.push({
        index: i,
        task_id: taskId,
        error: error.message,
        error_type: errorType,
        retryable: errorType === 'STATUS_ERROR'
      });
      results.summary.failed_count++;
    }
  }

  return results;
}

function batchCancel(taskIds, operator, role, reason) {
  const results = {
    success: [],
    failed: [],
    summary: {
      total: taskIds.length,
      success_count: 0,
      failed_count: 0
    }
  };

  for (let i = 0; i < taskIds.length; i++) {
    const taskId = taskIds[i];
    try {
      const result = taskService.cancelTask(taskId, operator, role, reason);
      results.success.push({
        index: i,
        task_id: taskId,
        result
      });
      results.summary.success_count++;
    } catch (error) {
      const errorType = error.message.includes('不存在') ? 'NOT_FOUND' : 'STATUS_ERROR';
      results.failed.push({
        index: i,
        task_id: taskId,
        error: error.message,
        error_type: errorType,
        retryable: false
      });
      results.summary.failed_count++;
    }
  }

  return results;
}

function batchRetry(failedItems, operator, role) {
  const results = {
    success: [],
    failed: [],
    summary: {
      total: failedItems.length,
      success_count: 0,
      failed_count: 0
    }
  };

  for (let i = 0; i < failedItems.length; i++) {
    const item = failedItems[i];
    if (!item.retryable) {
      results.failed.push({
        ...item,
        error: '该操作不可重试',
        error_type: 'NOT_RETRYABLE'
      });
      results.summary.failed_count++;
      continue;
    }

    try {
      let result;
      switch (item.operation) {
        case 'create':
          result = taskService.createTask(item.data, operator, role);
          break;
        case 'accept':
          result = taskService.acceptTask(item.task_id, operator, role);
          break;
        default:
          throw new Error('未知的操作类型');
      }

      results.success.push({
        ...item,
        result,
        retried: true
      });
      results.summary.success_count++;
    } catch (error) {
      results.failed.push({
        ...item,
        error: error.message,
        error_type: 'RETRY_FAILED',
        retryable: true
      });
      results.summary.failed_count++;
    }
  }

  return results;
}

module.exports = {
  batchCreate,
  batchAccept,
  batchCancel,
  batchRetry
};
