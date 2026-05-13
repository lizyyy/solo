const express = require('express');
const router = express.Router();
const { TASK_TYPES, TENANT_LEVELS, TASK_STATUSES } = require('../models/Task');

const validateTask = (body) => {
  const errors = [];
  
  if (!body.tenantId) {
    errors.push('tenantId 是必填字段');
  }
  
  if (!body.taskType) {
    errors.push('taskType 是必填字段');
  } else if (!Object.values(TASK_TYPES).includes(body.taskType)) {
    errors.push(`taskType 必须是以下值之一: ${Object.values(TASK_TYPES).join(', ')}`);
  }
  
  if (body.tenantLevel && !Object.values(TENANT_LEVELS).includes(body.tenantLevel)) {
    errors.push(`tenantLevel 必须是以下值之一: ${Object.values(TENANT_LEVELS).join(', ')}`);
  }
  
  if (body.priority !== undefined && (typeof body.priority !== 'number' || body.priority < 0 || body.priority > 20)) {
    errors.push('priority 必须是 0-20 之间的整数');
  }
  
  if (body.resourceEstimate) {
    if (body.resourceEstimate.cpu !== undefined && (body.resourceEstimate.cpu < 0 || body.resourceEstimate.cpu > 8)) {
      errors.push('resourceEstimate.cpu 必须在 0-8 之间');
    }
    if (body.resourceEstimate.memory !== undefined && (body.resourceEstimate.memory < 0 || body.resourceEstimate.memory > 16)) {
      errors.push('resourceEstimate.memory 必须在 0-16 GB 之间');
    }
  }
  
  if (body.deadline) {
    const date = new Date(body.deadline);
    if (isNaN(date.getTime())) {
      errors.push('deadline 必须是有效的 ISO 格式日期字符串');
    }
  }
  
  return errors;
};

module.exports = (arbitrator) => {
  router.post('/', (req, res) => {
    const errors = validateTask(req.body);
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
        message: '请求参数验证失败'
      });
    }
    
    const taskData = {
      taskId: req.body.taskId,
      tenantId: req.body.tenantId,
      taskType: req.body.taskType,
      tenantLevel: req.body.tenantLevel || TENANT_LEVELS.GUEST,
      priority: req.body.priority || 0,
      deadline: req.body.deadline,
      resourceEstimate: req.body.resourceEstimate || { cpu: 1, memory: 1, duration: 60 },
      payload: req.body.payload || {},
      idempotencyKey: req.body.idempotencyKey
    };
    
    const result = arbitrator.submitTask(taskData);
    const arbitrationResults = arbitrator.runArbitration();
    
    res.status(result.isNew ? 201 : 200).json({
      success: true,
      data: {
        task: result.task.toJSON(),
        isNew: result.isNew,
        submissionReason: result.reason,
        arbitrationResults,
        statistics: arbitrator.getQueueStatistics()
      },
      message: result.isNew ? '任务提交成功' : '重复任务，返回已有结果'
    });
  });

  router.get('/', (req, res) => {
    const { status } = req.query;
    
    let tasks;
    if (status && Object.values(TASK_STATUSES).includes(status)) {
      tasks = arbitrator.getAllTasks(status);
    } else if (status) {
      return res.status(400).json({
        success: false,
        message: `无效的状态值。有效状态: ${Object.values(TASK_STATUSES).join(', ')}`
      });
    } else {
      tasks = arbitrator.getAllTasks();
    }
    
    const taskList = tasks.map(t => t.toJSON()).sort((a, b) => b.effectivePriority - a.effectivePriority);
    
    res.json({
      success: true,
      data: {
        tasks: taskList,
        total: taskList.length,
        statistics: arbitrator.getQueueStatistics()
      }
    });
  });

  router.get('/statistics', (req, res) => {
    const stats = arbitrator.getQueueStatistics();
    const allTasks = arbitrator.getAllTasks();
    
    const byType = {};
    const byTenantLevel = {};
    const byStatus = {};
    
    Object.values(TASK_TYPES).forEach(t => byType[t] = 0);
    Object.values(TENANT_LEVELS).forEach(t => byTenantLevel[t] = 0);
    Object.values(TASK_STATUSES).forEach(s => byStatus[s] = 0);
    
    allTasks.forEach(task => {
      byType[task.taskType] = (byType[task.taskType] || 0) + 1;
      byTenantLevel[task.tenantLevel] = (byTenantLevel[task.tenantLevel] || 0) + 1;
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;
    });
    
    const pendingTasks = allTasks.filter(t => t.status === TASK_STATUSES.PENDING);
    const avgWaitTime = pendingTasks.length > 0 
      ? Math.round(pendingTasks.reduce((sum, t) => sum + t.waitTimeMs, 0) / pendingTasks.length)
      : 0;
    const maxWaitTime = pendingTasks.length > 0
      ? Math.max(...pendingTasks.map(t => t.waitTimeMs))
      : 0;
    
    res.json({
      success: true,
      data: {
        overview: stats,
        breakdown: {
          byTaskType: byType,
          byTenantLevel: byTenantLevel,
          byStatus: byStatus
        },
        performance: {
          avgPendingWaitTimeMs: avgWaitTime,
          maxPendingWaitTimeMs: maxWaitTime,
          avgWaitTimeFormatted: `${Math.round(avgWaitTime / 1000)}秒`,
          maxWaitTimeFormatted: `${Math.round(maxWaitTime / 1000)}秒`
        }
      }
    });
  });

  router.get('/:taskId', (req, res) => {
    const { taskId } = req.params;
    const task = arbitrator.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: {
        task: task.toJSON(),
        arbitrationAnalysis: {
          currentPriority: task.effectivePriority,
          userPriority: task.userPriority,
          arbitrationReason: task.arbitrationReason,
          isEligibleForPreemption: task.taskType === TASK_TYPES.BATCH_PROCESSING || task.taskType === TASK_TYPES.COMPENSATION,
          isVIPEligible: task.tenantLevel === TENANT_LEVELS.GOLD && task.taskType === TASK_TYPES.REALTIME_EXPORT,
          waitTimeAnalysis: {
            waitTimeMs: task.waitTimeMs,
            ageBonus: Math.min(Math.floor(task.waitTimeMs / 10000) * 2, 30),
            isAging: task.waitTimeMs > 30000
          }
        }
      }
    });
  });

  router.post('/:taskId/complete', (req, res) => {
    const { taskId } = req.params;
    const task = arbitrator.completeTask(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或不在运行状态'
      });
    }
    
    res.json({
      success: true,
      data: {
        task: task.toJSON(),
        message: '任务已标记为完成，仲裁引擎已重新调度'
      }
    });
  });

  router.post('/:taskId/fail', (req, res) => {
    const { taskId } = req.params;
    const { error } = req.body;
    const task = arbitrator.failTask(taskId, error);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在或不在运行状态'
      });
    }
    
    res.json({
      success: true,
      data: {
        task: task.toJSON(),
        message: '任务已标记为失败，仲裁引擎已重新调度'
      }
    });
  });

  return router;
};
