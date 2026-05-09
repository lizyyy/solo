const storage = require('../storage');
const paymentService = require('./paymentService');

const TASK_TYPES = {
  PAYMENT_CALLBACK: 'payment_callback',
  RECONCILIATION: 'reconciliation',
  ARREAR_UPDATE: 'arrear_update',
  NOTIFICATION: 'notification'
};

const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  RETRY: 'retry'
};

function recordFailedTask(params) {
  const task = {
    type: params.type,
    relatedId: params.relatedId,
    errorMessage: params.errorMessage,
    data: params.data || {},
    retryCount: 0,
    status: TASK_STATUS.FAILED,
    lastAttemptAt: new Date().toISOString()
  };
  return storage.insert('failedTasks', task);
}

function getFailedTasks() {
  return storage.findMany('failedTasks', t => 
    t.status === TASK_STATUS.FAILED || t.status === TASK_STATUS.RETRY
  );
}

function executeTask(task) {
  switch (task.type) {
    case TASK_TYPES.PAYMENT_CALLBACK:
      if (!task.data.orderNo || !task.data.callbackData) {
        throw new Error('缺少支付回调必要参数');
      }
      return paymentService.handlePaymentCallback(task.data.orderNo, task.data.callbackData);

    case TASK_TYPES.ARREAR_UPDATE:
      if (!task.data.arrearId || task.data.paidAmount === undefined) {
        throw new Error('缺少欠费更新必要参数');
      }
      const arrear = storage.findById('arrearRecords', task.data.arrearId);
      if (!arrear) throw new Error('欠费记录不存在');
      const newPaid = arrear.paidAmount + task.data.paidAmount;
      const newRemaining = Math.max(0, arrear.totalAmount - newPaid);
      const newStatus = newRemaining === 0 ? 'paid' : 
        (newPaid > 0 ? 'partial' : 'unpaid');
      return storage.update('arrearRecords', task.data.arrearId, {
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        status: newStatus
      });

    default:
      throw new Error('未知任务类型: ' + task.type);
  }
}

function retryTask(taskId) {
  const task = storage.findById('failedTasks', taskId);
  if (!task) throw new Error('任务不存在');

  if (task.status === TASK_STATUS.SUCCESS) {
    throw new Error('该任务已成功执行');
  }

  storage.update('failedTasks', taskId, {
    status: TASK_STATUS.RUNNING,
    lastAttemptAt: new Date().toISOString()
  });

  try {
    const result = executeTask(task);
    storage.update('failedTasks', taskId, {
      status: TASK_STATUS.SUCCESS,
      retryCount: task.retryCount + 1,
      successAt: new Date().toISOString()
    });
    return { success: true, result };
  } catch (error) {
    storage.update('failedTasks', taskId, {
      status: TASK_STATUS.RETRY,
      retryCount: task.retryCount + 1,
      lastErrorMessage: error.message,
      lastAttemptAt: new Date().toISOString()
    });
    return { success: false, error: error.message };
  }
}

function retryAllFailedTasks() {
  const failedTasks = getFailedTasks();
  const results = [];

  for (const task of failedTasks) {
    try {
      const result = retryTask(task.id);
      results.push({
        taskId: task.id,
        type: task.type,
        ...result
      });
    } catch (error) {
      results.push({
        taskId: task.id,
        type: task.type,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

function getTaskHistory(taskId) {
  return storage.findById('failedTasks', taskId);
}

function getAllTaskHistory() {
  return storage.findAll('failedTasks');
}

module.exports = {
  TASK_TYPES,
  TASK_STATUS,
  recordFailedTask,
  getFailedTasks,
  retryTask,
  retryAllFailedTasks,
  getTaskHistory,
  getAllTaskHistory
};
