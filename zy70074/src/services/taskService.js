const { generateId } = require('../data/store');
const { createError, ErrorCodes: EC } = require('./errors');

const TaskStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING'
};

const tasks = [];
const taskHandlers = new Map();

const defaultRetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2
};

function registerTaskHandler(taskType, handler) {
  taskHandlers.set(taskType, handler);
}

function createTask(taskType, payload, options = {}) {
  const task = {
    id: generateId(),
    type: taskType,
    payload,
    status: TaskStatus.PENDING,
    retryConfig: {
      maxRetries: options.maxRetries ?? defaultRetryConfig.maxRetries,
      initialDelay: options.initialDelay ?? defaultRetryConfig.initialDelay,
      backoffMultiplier: options.backoffMultiplier ?? defaultRetryConfig.backoffMultiplier
    },
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    error: null,
    result: null,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  
  tasks.push(task);
  return task;
}

function getTask(id) {
  return tasks.find(t => t.id === id);
}

function listTasks(filters = {}) {
  let results = [...tasks];
  
  if (filters.status) {
    results = results.filter(t => t.status === filters.status);
  }
  if (filters.type) {
    results = results.filter(t => t.type === filters.type);
  }
  
  return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function calculateNextDelay(task) {
  const { initialDelay, backoffMultiplier } = task.retryConfig;
  return initialDelay * Math.pow(backoffMultiplier, task.attemptCount);
}

function canRetry(task) {
  return task.attemptCount < task.retryConfig.maxRetries;
}

async function executeTask(task) {
  const handler = taskHandlers.get(task.type);
  if (!handler) {
    throw new Error(`No handler registered for task type: ${task.type}`);
  }
  
  task.status = TaskStatus.RUNNING;
  task.attemptCount++;
  task.lastAttemptAt = new Date().toISOString();
  
  try {
    const result = await handler(task.payload);
    task.status = TaskStatus.COMPLETED;
    task.result = result;
    task.completedAt = new Date().toISOString();
    task.error = null;
    
    return { success: true, task };
  } catch (err) {
    task.error = {
      message: err.message,
      code: err.code || 'UNKNOWN_ERROR',
      details: err.details || null
    };
    
    if (canRetry(task)) {
      task.status = TaskStatus.RETRYING;
      task.nextAttemptAt = new Date(
        Date.now() + calculateNextDelay(task)
      ).toISOString();
      
      return {
        success: false,
        willRetry: true,
        retryAttempt: task.attemptCount,
        maxRetries: task.retryConfig.maxRetries,
        nextAttemptAt: task.nextAttemptAt,
        task
      };
    } else {
      task.status = TaskStatus.FAILED;
      task.completedAt = new Date().toISOString();
      
      return {
        success: false,
        willRetry: false,
        retryAttempt: task.attemptCount,
        maxRetries: task.retryConfig.maxRetries,
        task
      };
    }
  }
}

async function processPendingTasks() {
  const pendingTasks = tasks.filter(t => 
    t.status === TaskStatus.PENDING ||
    (t.status === TaskStatus.RETRYING && 
     (!t.nextAttemptAt || new Date(t.nextAttemptAt) <= new Date()))
  );
  
  const results = [];
  for (const task of pendingTasks) {
    const result = await executeTask(task);
    results.push(result);
  }
  
  return results;
}

registerTaskHandler('UPDATE_FINANCE_AFTER_TRANSFER', async (payload) => {
  console.log(`[Task] 更新财务系统 - 资产调拨完成: ${payload.transferId}`);
  console.log(`  - 调出部门: ${payload.outgoingDepartment}`);
  console.log(`  - 调入部门: ${payload.incomingDepartment}`);
  console.log(`  - 资产: ${payload.assetNo}`);
  
  if (payload.simulateFailure) {
    throw createError(EC.TASK_FAILED, {
      transferId: payload.transferId,
      reason: '财务系统连接超时'
    }, '财务系统连接超时，请检查网络后重试');
  }
  
  return {
    financeReferenceId: `FIN-${Date.now()}`,
    processedAt: new Date().toISOString()
  };
});

registerTaskHandler('SEND_NOTIFICATION', async (payload) => {
  console.log(`[Task] 发送通知 - 类型: ${payload.type}`);
  console.log(`  - 接收人: ${payload.recipient}`);
  console.log(`  - 消息: ${payload.message}`);
  
  return {
    notificationId: `NOTIF-${Date.now()}`,
    sentAt: new Date().toISOString()
  };
});

registerTaskHandler('SYNC_DEPRECIATION_LEDGER', async (payload) => {
  console.log(`[Task] 同步折旧台账 - 部门: ${payload.department}`);
  
  if (payload.simulateFailure) {
    throw new Error('折旧系统维护中');
  }
  
  return {
    syncId: `SYNC-${Date.now()}`,
    recordsCount: payload.assets?.length || 0
  };
});

module.exports = {
  TaskStatus,
  registerTaskHandler,
  createTask,
  getTask,
  listTasks,
  executeTask,
  processPendingTasks,
  canRetry
};
