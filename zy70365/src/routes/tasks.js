const express = require('express');
const router = express.Router();
const { TaskManager, TASK_STATES, POLICY_TYPES, QUOTA_PRESETS, FAILURE_REASONS } = require('../core/taskManager');
const { SandboxExecutor, SIMULATION_MODES } = require('../core/sandboxExecutor');
const { logger } = require('../utils/logger');

const taskManager = new TaskManager();
const executor = new SandboxExecutor();

router.get('/policies', (req, res) => {
  try {
    res.json({
      success: true,
      policies: {
        types: POLICY_TYPES,
        defaultPolicies: {
          read_only: '只读策略：只允许读取特定目录的文件',
          write_restricted: '受限写策略：允许读写工作目录',
          no_filesystem: '无文件系统策略：完全禁止文件系统访问',
          no_network: '无网络策略：允许文件访问，禁止网络',
          limited: '受限策略（默认）：限制文件访问和网络',
          full: '完全策略：完全访问权限（管理员用）'
        }
      }
    });
  } catch (error) {
    logger.error('获取策略列表失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/quotas', (req, res) => {
  try {
    res.json({
      success: true,
      quotas: {
        presets: QUOTA_PRESETS
      }
    });
  } catch (error) {
    logger.error('获取配额预设失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/states', (req, res) => {
  try {
    res.json({
      success: true,
      states: TASK_STATES,
      failureReasons: FAILURE_REASONS
    });
  } catch (error) {
    logger.error('获取状态列表失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/simulation-modes', (req, res) => {
  try {
    res.json({
      success: true,
      modes: {
        normal: '正常执行模式',
        timeout: '模拟超时执行',
        permission_violation: '模拟权限违规',
        memory_exceeded: '模拟内存超限',
        cpu_exceeded: '模拟CPU超限',
        normal_with_logs: '正常执行带详细日志'
      }
    });
  } catch (error) {
    logger.error('获取模拟模式列表失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const {
      name,
      scriptContent,
      scriptType,
      parameters,
      submitter,
      policyType,
      customPolicy,
      quotaPreset,
      customQuotas
    } = req.body;

    if (!submitter) {
      return res.status(400).json({
        success: false,
        message: '缺少提交者信息 (submitter)'
      });
    }

    if (name) {
      const duplicateCheck = taskManager.checkDuplicateSubmission(name, submitter);
      if (duplicateCheck.isDuplicate) {
        return res.status(409).json({
          success: false,
          message: '存在同名的未完成任务，禁止重复提交',
          existingTask: {
            taskId: duplicateCheck.existingTaskId,
            state: duplicateCheck.existingTaskState
          },
          failureReason: FAILURE_REASONS.DUPLICATE_SUBMISSION
        });
      }
    }

    const task = taskManager.createTask({
      name,
      scriptContent,
      scriptType,
      parameters,
      submitter,
      policyType,
      customPolicy,
      quotaPreset,
      customQuotas
    });

    logger.info(`创建任务: ${task.id}`, { name, submitter });

    res.status(201).json({
      success: true,
      message: '任务创建成功',
      task: task.getStatus()
    });
  } catch (error) {
    logger.error('创建任务失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/submit', (req, res) => {
  try {
    const { taskId } = req.params;
    const { operator } = req.body;

    const task = taskManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const result = task.submit(operator || task.submitter);
    
    if (result.success) {
      task.enqueue();
      logger.info(`任务提交并入队: ${taskId}`);
    }

    res.json({
      ...result,
      task: task.getStatus()
    });
  } catch (error) {
    logger.error('提交任务失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/execute', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { 
      simulationMode = SIMULATION_MODES.NORMAL, 
      options = {},
      operator 
    } = req.body;

    const task = taskManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const currentState = task.stateMachine.getCurrentState();
    
    if (currentState === TASK_STATES.PENDING) {
      task.submit(operator || task.submitter);
    }
    
    if (currentState === TASK_STATES.SUBMITTED || currentState === TASK_STATES.PENDING) {
      task.enqueue();
    }

    if (task.stateMachine.getCurrentState() !== TASK_STATES.QUEUED) {
      return res.status(400).json({
        success: false,
        message: `任务状态不允许执行: ${task.stateMachine.getStateDescription()}`,
        currentState: task.stateMachine.getCurrentState()
      });
    }

    logger.info(`开始执行任务: ${taskId}, 模式: ${simulationMode}`);

    executor.execute(task, simulationMode, options).then((executionResult) => {
      logger.info(`任务执行完成: ${taskId}, 状态: ${executionResult.state}`);
    }).catch((error) => {
      logger.error(`任务执行异常: ${taskId}`, error);
      task.fail(FAILURE_REASONS.EXECUTION_ERROR, { error: error.message });
    });

    res.json({
      success: true,
      message: '任务开始执行',
      taskId,
      simulationMode,
      currentState: task.stateMachine.getCurrentState(),
      stateDescription: task.stateMachine.getStateDescription()
    });
  } catch (error) {
    logger.error('执行任务失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const { detailed = 'false' } = req.query;

    const task = taskManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const response = {
      success: true,
      task: detailed === 'true' ? task.getDetailedInfo() : task.getStatus()
    };

    res.json(response);
  } catch (error) {
    logger.error('获取任务详情失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { submitter, state, policyType, startDate, endDate } = req.query;
    
    const filters = {};
    if (submitter) filters.submitter = submitter;
    if (state) filters.state = state;
    if (policyType) filters.policyType = policyType;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const tasks = taskManager.listTasks(filters);
    
    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error) {
    logger.error('列出任务失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:taskId/logs', (req, res) => {
  try {
    const { taskId } = req.params;
    const { type } = req.query;

    const logs = taskManager.getTaskLogs(taskId, type);
    
    if (logs === null) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    res.json({
      success: true,
      taskId,
      logCount: logs.length,
      logs
    });
  } catch (error) {
    logger.error('获取任务日志失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/cancel', (req, res) => {
  try {
    const { taskId } = req.params;
    const { operator, reason } = req.body;

    const task = taskManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    if (task.stateMachine.isTerminal()) {
      return res.status(400).json({
        success: false,
        message: '任务已在终止状态，无法取消',
        currentState: task.stateMachine.getCurrentState()
      });
    }

    if (executor.isRunning(taskId)) {
      executor.cancelExecution(taskId);
    }

    const result = task.cancel(operator || task.submitter, reason || '用户取消任务');

    logger.info(`任务取消: ${taskId}`, { operator, reason });

    res.json({
      ...result,
      task: task.getStatus(),
      canWriteResult: task.canWriteResult()
    });
  } catch (error) {
    logger.error('取消任务失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:taskId/kill', (req, res) => {
  try {
    const { taskId } = req.params;
    const { operator = 'admin', reason } = req.body;

    const task = taskManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    if (task.stateMachine.isTerminal()) {
      return res.status(400).json({
        success: false,
        message: '任务已在终止状态，无法终止',
        currentState: task.stateMachine.getCurrentState()
      });
    }

    if (executor.isRunning(taskId)) {
      executor.cancelExecution(taskId);
    }

    const result = task.kill(operator, reason || '管理员强制终止任务');

    logger.info(`管理员终止任务: ${taskId}`, { operator, reason });

    res.json({
      ...result,
      task: task.getStatus(),
      canWriteResult: task.canWriteResult()
    });
  } catch (error) {
    logger.error('终止任务失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:taskId/export', (req, res) => {
  try {
    const { taskId } = req.params;
    const { format = 'json' } = req.query;

    const exportData = taskManager.exportTaskResult(taskId);
    
    if (exportData === null) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="task-${taskId}-export.json"`);
      res.json(exportData);
    } else {
      res.json({
        success: true,
        taskId,
        exportData
      });
    }
  } catch (error) {
    logger.error('导出任务结果失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:taskId/check-permission', (req, res) => {
  try {
    const { taskId } = req.params;
    const { operation, resource } = req.query;

    const task = taskManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    if (!operation) {
      return res.status(400).json({
        success: false,
        message: '缺少操作类型 (operation). 可选: readFile, writeFile, network, process'
      });
    }

    const result = task.checkPermissions(operation, resource);

    res.json({
      success: true,
      taskId,
      operation,
      resource,
      permissionCheck: result
    });
  } catch (error) {
    logger.error('权限检查失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:taskId/resources', (req, res) => {
  try {
    const { taskId } = req.params;

    const task = taskManager.getTask(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const usage = task.resourceQuota.getUsage();
    const progress = task.resourceQuota.getProgress();
    const limits = task.checkResources();

    res.json({
      success: true,
      taskId,
      quotas: task.resourceQuota.getQuotas(),
      usage,
      progress,
      limitsExceeded: limits.anyExceeded,
      violations: limits.violations
    });
  } catch (error) {
    logger.error('获取资源信息失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/running/list', (req, res) => {
  try {
    const runningTaskIds = executor.getRunningTasks();
    const runningTasks = runningTaskIds.map(taskId => {
      const task = taskManager.getTask(taskId);
      return task ? task.getStatus() : null;
    }).filter(Boolean);

    res.json({
      success: true,
      count: runningTasks.length,
      runningTasks
    });
  } catch (error) {
    logger.error('获取运行中任务失败', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
