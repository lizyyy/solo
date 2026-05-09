const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');

router.get('/', (req, res) => {
  const { status, type } = req.query;
  const tasks = taskService.listTasks({ status, type });
  
  res.json({
    success: true,
    data: tasks
  });
});

router.get('/:id', (req, res) => {
  const task = taskService.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: '任务不存在'
      }
    });
  }
  
  res.json({
    success: true,
    data: task
  });
});

router.post('/:id/retry', async (req, res) => {
  const task = taskService.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: '任务不存在'
      }
    });
  }
  
  if (!taskService.canRetry(task)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MAX_RETRIES_EXCEEDED',
        message: '任务已达到最大重试次数',
        details: {
          attemptCount: task.attemptCount,
          maxRetries: task.retryConfig.maxRetries
        }
      }
    });
  }
  
  task.status = taskService.TaskStatus.PENDING;
  task.nextAttemptAt = null;
  
  const result = await taskService.executeTask(task);
  
  res.json({
    success: true,
    data: result
  });
});

router.post('/process', async (req, res) => {
  const results = await taskService.processPendingTasks();
  
  res.json({
    success: true,
    data: {
      processedCount: results.length,
      results
    }
  });
});

module.exports = router;
