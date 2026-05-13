const { logger } = require('../utils/logger');
const { FAILURE_REASONS } = require('./taskStateMachine');

const SIMULATION_MODES = {
  NORMAL: 'normal',
  TIMEOUT: 'timeout',
  PERMISSION_VIOLATION: 'permission_violation',
  MEMORY_EXCEEDED: 'memory_exceeded',
  CPU_EXCEEDED: 'cpu_exceeded',
  NORMAL_WITH_LOGS: 'normal_with_logs'
};

class SandboxExecutor {
  constructor() {
    this.runningExecutions = new Map();
  }

  async execute(task, simulationMode = SIMULATION_MODES.NORMAL, options = {}) {
    return new Promise((resolve, reject) => {
      const startResult = task.start();
      if (!startResult.success) {
        return resolve({ success: false, message: startResult.message });
      }

      const executionId = `exec-${task.id}-${Date.now()}`;
      this.runningExecutions.set(task.id, {
        executionId,
        task,
        isCancelled: false,
        timeoutHandle: null,
        intervalHandle: null
      });

      logger.info(`开始执行任务 ${task.id}, 模式: ${simulationMode}`);

      const execution = this.runningExecutions.get(task.id);

      execution.timeoutHandle = setTimeout(() => {
        this._runSimulation(task, simulationMode, options, execution, resolve, reject);
      }, 100);
    });
  }

  _runSimulation(task, simulationMode, options, execution, resolve, reject) {
    const executionContext = {
      step: 0,
      memorySimulated: 0,
      cpuSimulated: 0
    };

    switch (simulationMode) {
      case SIMULATION_MODES.NORMAL:
        this._simulateNormalExecution(task, options, execution, resolve);
        break;
      case SIMULATION_MODES.TIMEOUT:
        this._simulateTimeoutExecution(task, options, execution, resolve);
        break;
      case SIMULATION_MODES.PERMISSION_VIOLATION:
        this._simulatePermissionViolation(task, options, execution, resolve);
        break;
      case SIMULATION_MODES.MEMORY_EXCEEDED:
        this._simulateMemoryExceeded(task, options, execution, resolve);
        break;
      case SIMULATION_MODES.CPU_EXCEEDED:
        this._simulateCPUExceeded(task, options, execution, resolve);
        break;
      case SIMULATION_MODES.NORMAL_WITH_LOGS:
        this._simulateNormalWithLogs(task, options, execution, resolve);
        break;
      default:
        this._simulateNormalExecution(task, options, execution, resolve);
    }
  }

  _simulateNormalExecution(task, options, execution, resolve) {
    const duration = options.duration || 2000;
    const steps = options.steps || 5;
    
    let currentStep = 0;
    
    const stepInterval = setInterval(() => {
      if (execution.isCancelled) {
        clearInterval(stepInterval);
        this._handleCancellation(task, execution, resolve);
        return;
      }

      currentStep++;
      task.addUserLog(`执行步骤 ${currentStep}/${steps}: 处理数据中...`, { progress: (currentStep / steps) * 100 });
      
      const simulatedMemory = 10 + (currentStep * 5);
      const simulatedCPU = 10 + (currentStep * 8);
      task.resourceQuota.updateMemoryUsage(simulatedMemory);
      task.resourceQuota.updateCPUUsage(simulatedCPU);

      const resourceCheck = task.checkResources();
      if (resourceCheck.anyExceeded) {
        clearInterval(stepInterval);
        this._handleResourceExceeded(task, execution, resolve, resourceCheck);
        return;
      }

      if (currentStep >= steps) {
        clearInterval(stepInterval);
        this._completeExecution(task, execution, resolve, {
          status: 'success',
          message: '任务执行完成',
          processedItems: 100,
          duration: duration
        });
      }
    }, duration / steps);

    execution.intervalHandle = stepInterval;
  }

  _simulateNormalWithLogs(task, options, execution, resolve) {
    const duration = options.duration || 3000;
    const logCount = options.logCount || 10;
    
    let currentLog = 0;
    
    const logInterval = setInterval(() => {
      if (execution.isCancelled) {
        clearInterval(logInterval);
        this._handleCancellation(task, execution, resolve);
        return;
      }

      currentLog++;
      const logTypes = ['info', 'processing', 'status', 'debug'];
      const type = logTypes[currentLog % logTypes.length];
      
      task.addUserLog(`[${type}] 日志消息 #${currentLog}: ${this._generateRandomLog(type)}`, {
        logNumber: currentLog,
        type
      });
      
      task.resourceQuota.updateMemoryUsage(5 + (currentLog * 2));
      
      const resourceCheck = task.checkResources();
      if (resourceCheck.anyExceeded) {
        clearInterval(logInterval);
        this._handleResourceExceeded(task, execution, resolve, resourceCheck);
        return;
      }

      if (currentLog >= logCount) {
        clearInterval(logInterval);
        this._completeExecution(task, execution, resolve, {
          status: 'success',
          message: '带日志任务执行完成',
          totalLogs: currentLog,
          duration: duration
        });
      }
    }, duration / logCount);

    execution.intervalHandle = logInterval;
  }

  _simulateTimeoutExecution(task, options, execution, resolve) {
    const timeoutDuration = options.timeoutDuration || 5000;
    const simulatedWorkDuration = options.simulatedDuration || 8000;
    
    task.addUserLog('开始执行长时间运行的任务...预计需要较长时间');
    task.logger.system(`模拟任务将运行 ${simulatedWorkDuration}ms，但配额限制为 ${timeoutDuration}ms`);
    
    setTimeout(() => {
      if (execution.isCancelled) {
        this._handleCancellation(task, execution, resolve);
        return;
      }

      task.addUserLog('任务仍在执行中，已超过配额时间限制...');
      
      task.resourceQuota.start();
      for (let i = 0; i < timeoutDuration + 1000; i += 100) {
        task.resourceQuota.usage.executionTime = i;
      }
      
      const timeCheck = task.resourceQuota.checkTimeLimit();
      if (timeCheck.exceeded) {
        task.timeout({
          exceededTime: task.resourceQuota.usage.executionTime,
          limit: task.resourceQuota.quotas.maxExecutionTime
        });
        
        this.runningExecutions.delete(task.id);
        resolve({
          success: false,
          taskId: task.id,
          state: task.stateMachine.getCurrentState(),
          result: task.result,
          reason: FAILURE_REASONS.TIMED_OUT
        });
      }
    }, 2000);

    execution.timeoutHandle = setTimeout(() => {
      if (!execution.isCancelled && !task.stateMachine.isTerminal()) {
        task.timeout({
          message: '模拟执行超时',
          expectedTime: simulatedWorkDuration,
          limit: task.resourceQuota.quotas.maxExecutionTime
        });
        
        this.runningExecutions.delete(task.id);
        resolve({
          success: false,
          taskId: task.id,
          state: task.stateMachine.getCurrentState(),
          result: task.result,
          reason: FAILURE_REASONS.TIMED_OUT
        });
      }
    }, Math.min(timeoutDuration + 100, simulatedWorkDuration));
  }

  _simulatePermissionViolation(task, options, execution, resolve) {
    setTimeout(() => {
      if (execution.isCancelled) {
        this._handleCancellation(task, execution, resolve);
        return;
      }

      task.addUserLog('尝试读取系统文件...');
      
      const filePath = options.targetPath || '/etc/passwd';
      const permCheck = task.checkPermissions('readFile', filePath);
      
      if (!permCheck.allowed) {
        task.logger.platform(`权限违规检测: 尝试访问 ${filePath}`, {
          policy: permCheck.policy,
          reason: permCheck.reason
        });
        
        task.fail(FAILURE_REASONS.PERMISSION_VIOLATION, {
          operation: 'readFile',
          target: filePath,
          policy: permCheck.policy,
          reason: permCheck.reason
        });
        
        this.runningExecutions.delete(task.id);
        resolve({
          success: false,
          taskId: task.id,
          state: task.stateMachine.getCurrentState(),
          result: task.result,
          reason: FAILURE_REASONS.PERMISSION_VIOLATION,
          details: {
            operation: 'readFile',
            target: filePath,
            policy: permCheck.policy,
            reason: permCheck.reason
          }
        });
      } else {
        this._completeExecution(task, execution, resolve, {
          status: 'success',
          message: '权限检查通过（但模拟应该失败）',
          accessedPath: filePath
        });
      }
    }, 500);
  }

  _simulateMemoryExceeded(task, options, execution, resolve) {
    const memoryLimit = task.resourceQuota.quotas.maxMemoryMB;
    const stepMemory = (memoryLimit / 3) + 10;
    
    let currentMemory = 0;
    let step = 0;
    
    const memoryInterval = setInterval(() => {
      if (execution.isCancelled) {
        clearInterval(memoryInterval);
        this._handleCancellation(task, execution, resolve);
        return;
      }

      step++;
      currentMemory += stepMemory;
      
      task.addUserLog(`分配内存中...当前模拟内存: ${currentMemory}MB`);
      task.resourceQuota.updateMemoryUsage(currentMemory);
      
      const memCheck = task.resourceQuota.checkMemoryLimit();
      if (memCheck.exceeded) {
        clearInterval(memoryInterval);
        
        task.fail(FAILURE_REASONS.RESOURCE_EXCEEDED, {
          limitType: 'memory',
          used: currentMemory,
          max: memoryLimit,
          message: '内存使用超过配额限制'
        });
        
        this.runningExecutions.delete(task.id);
        resolve({
          success: false,
          taskId: task.id,
          state: task.stateMachine.getCurrentState(),
          result: task.result,
          reason: FAILURE_REASONS.RESOURCE_EXCEEDED,
          details: {
            limitType: 'memory',
            used: currentMemory,
            max: memoryLimit
          }
        });
      }
    }, 300);

    execution.intervalHandle = memoryInterval;
  }

  _simulateCPUExceeded(task, options, execution, resolve) {
    const cpuLimit = task.resourceQuota.quotas.maxCPUPercent;
    let currentCPU = 0;
    let step = 0;
    
    const cpuInterval = setInterval(() => {
      if (execution.isCancelled) {
        clearInterval(cpuInterval);
        this._handleCancellation(task, execution, resolve);
        return;
      }

      step++;
      currentCPU = Math.min(100, cpuLimit + (step * 10));
      
      task.addUserLog(`CPU 密集计算中...当前模拟 CPU: ${currentCPU}%`);
      task.resourceQuota.updateCPUUsage(currentCPU);
      
      const cpuCheck = task.resourceQuota.checkCPULimit();
      if (cpuCheck.exceeded) {
        clearInterval(cpuInterval);
        
        task.fail(FAILURE_REASONS.RESOURCE_EXCEEDED, {
          limitType: 'cpu',
          used: currentCPU,
          max: cpuLimit,
          message: 'CPU使用超过配额限制'
        });
        
        this.runningExecutions.delete(task.id);
        resolve({
          success: false,
          taskId: task.id,
          state: task.stateMachine.getCurrentState(),
          result: task.result,
          reason: FAILURE_REASONS.RESOURCE_EXCEEDED,
          details: {
            limitType: 'cpu',
            used: currentCPU,
            max: cpuLimit
          }
        });
      }
    }, 400);

    execution.intervalHandle = cpuInterval;
  }

  _handleCancellation(task, execution, resolve) {
    task.cancel('system', '任务被用户取消');
    this.runningExecutions.delete(task.id);
    
    resolve({
      success: false,
      taskId: task.id,
      state: task.stateMachine.getCurrentState(),
      result: task.result,
      reason: FAILURE_REASONS.CANCELLED_BY_USER,
      cancelled: true
    });
  }

  _handleResourceExceeded(task, execution, resolve, resourceCheck) {
    task.fail(FAILURE_REASONS.RESOURCE_EXCEEDED, {
      violations: resourceCheck.violations,
      messages: resourceCheck.messages
    });
    
    this.runningExecutions.delete(task.id);
    resolve({
      success: false,
      taskId: task.id,
      state: task.stateMachine.getCurrentState(),
      result: task.result,
      reason: FAILURE_REASONS.RESOURCE_EXCEEDED,
      details: {
        violations: resourceCheck.violations
      }
    });
  }

  _completeExecution(task, execution, resolve, resultData) {
    task.addUserLog('任务执行完成，正在保存结果...');
    
    if (!task.canWriteResult()) {
      task.logger.platform('任务已被取消或失败，无法写入结果');
      task.fail(FAILURE_REASONS.CANCELLED_BY_USER, {
        message: '用户取消后无法继续写入结果',
        canWriteResult: false
      });
      
      this.runningExecutions.delete(task.id);
      resolve({
        success: false,
        taskId: task.id,
        state: task.stateMachine.getCurrentState(),
        result: task.result,
        reason: FAILURE_REASONS.CANCELLED_BY_USER
      });
      return;
    }
    
    task.complete(resultData);
    
    this.runningExecutions.delete(task.id);
    resolve({
      success: true,
      taskId: task.id,
      state: task.stateMachine.getCurrentState(),
      result: task.result
    });
  }

  cancelExecution(taskId) {
    const execution = this.runningExecutions.get(taskId);
    
    if (!execution) {
      return { success: false, message: '没有找到正在执行的任务' };
    }
    
    execution.isCancelled = true;
    
    if (execution.intervalHandle) {
      clearInterval(execution.intervalHandle);
    }
    if (execution.timeoutHandle) {
      clearTimeout(execution.timeoutHandle);
    }
    
    logger.info(`请求取消任务执行: ${taskId}`);
    
    return {
      success: true,
      message: '取消请求已发送'
    };
  }

  isRunning(taskId) {
    return this.runningExecutions.has(taskId);
  }

  getRunningTasks() {
    return Array.from(this.runningExecutions.keys());
  }

  _generateRandomLog(type) {
    const logs = {
      info: [
        '处理用户请求',
        '连接到数据源',
        '加载配置文件',
        '初始化工作区'
      ],
      processing: [
        '正在处理数据条目',
        '转换数据格式',
        '验证数据完整性',
        '应用业务规则'
      ],
      status: [
        '当前进度: 25%',
        '已处理 50 条记录',
        '预计剩余时间: 30秒',
        '内存使用正常'
      ],
      debug: [
        '函数调用栈信息',
        '变量值: x=10, y=20',
        '执行时间: 45ms',
        '缓存命中率: 85%'
      ]
    };
    
    const typeLogs = logs[type] || logs.info;
    return typeLogs[Math.floor(Math.random() * typeLogs.length)];
  }
}

module.exports = {
  SandboxExecutor,
  SIMULATION_MODES
};
