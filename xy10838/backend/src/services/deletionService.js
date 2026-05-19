const moment = require('moment');
const { db, uuid, getNow, saveDatabase } = require('../database');
const { applyDeletionRules } = require('./retentionService');

const generateRequestNo = () => {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DEL-${dateStr}-${random}`;
};

const createDeletionRequest = (data) => {
  const id = uuid();
  const requestNo = generateRequestNo();
  const request = {
    id,
    request_no: requestNo,
    customer_id: data.customerId,
    customer_name: data.customerName || '',
    reason: data.reason || '',
    requested_by: data.requestedBy,
    status: 'DRAFT',
    requested_at: getNow(),
    created_at: getNow(),
    updated_at: getNow()
  };
  
  db.deletion_requests.push(request);
  
  createAuditLog({
    requestId: id,
    action: 'CREATED',
    actor: data.requestedBy,
    details: `创建删除申请 ${requestNo}`
  });
  
  saveDatabase();
  return request;
};

const getDeletionRequests = (filters = {}) => {
  let results = [...db.deletion_requests];
  
  if (filters.status) {
    results = results.filter(r => r.status === filters.status);
  }
  if (filters.customerId) {
    results = results.filter(r => r.customer_id === filters.customerId);
  }
  
  return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

const getDeletionRequestById = (id) => {
  const request = db.deletion_requests.find(r => r.id === id);
  if (request) {
    const tasks = db.execution_tasks.filter(t => t.request_id === id);
    const domainMap = {};
    db.data_domains.forEach(d => { domainMap[d.id] = d.name; });
    request.tasks = tasks.map(t => ({
      ...t,
      domain_name: domainMap[t.domain_id] || t.domain_id
    }));
  }
  return request;
};

const updateRequestStatus = (requestId, newStatus, actor, additionalData = {}) => {
  const request = db.deletion_requests.find(r => r.id === requestId);
  if (!request) {
    throw new Error('删除申请不存在');
  }

  const validTransitions = {
    'DRAFT': ['PENDING_APPROVAL'],
    'PENDING_APPROVAL': ['APPROVED', 'REJECTED'],
    'APPROVED': ['EXECUTING', 'CANCELLED'],
    'EXECUTING': ['COMPLETED', 'PARTIAL_COMPLETED'],
    'PARTIAL_COMPLETED': ['COMPLETED', 'CLOSED'],
    'COMPLETED': ['CLOSED'],
    'FAILED': ['RETRY', 'CLOSED'],
    'REJECTED': ['CLOSED'],
    'CANCELLED': ['CLOSED']
  };

  if (!validTransitions[request.status]?.includes(newStatus)) {
    throw new Error(`无效的状态转换: ${request.status} -> ${newStatus}`);
  }

  const beforeState = JSON.stringify({ status: request.status });
  request.status = newStatus;
  request.updated_at = getNow();

  if (newStatus === 'APPROVED') {
    request.approved_by = actor;
    request.approved_at = getNow();
    applyDeletionRules(requestId);
  }
  if (newStatus === 'EXECUTING') {
    request.executed_by = actor;
    request.executed_at = getNow();
  }
  if (newStatus === 'COMPLETED' || newStatus === 'CLOSED') {
    request.completed_at = getNow();
  }

  createAuditLog({
    requestId,
    action: `STATUS_${newStatus}`,
    actor,
    beforeState,
    afterState: JSON.stringify({ status: newStatus }),
    details: additionalData.details || `状态变更为 ${newStatus}`
  });

  saveDatabase();
  return getDeletionRequestById(requestId);
};

const executeTask = (taskId, actor, simulateSuccess = null) => {
  const task = db.execution_tasks.find(t => t.id === taskId);
  if (!task) {
    throw new Error('执行任务不存在');
  }

  if (task.status !== 'PENDING' && task.status !== 'RETRYING') {
    throw new Error(`任务状态 ${task.status} 不可执行`);
  }

  task.status = 'EXECUTING';
  task.started_at = getNow();

  const total = task.total_records;
  let processed, failed;
  
  if (simulateSuccess === true) {
    processed = total;
    failed = 0;
  } else if (simulateSuccess === false) {
    processed = Math.floor(total * 0.4);
    failed = total - processed;
  } else {
    processed = Math.floor(total * (0.85 + Math.random() * 0.1));
    failed = total - processed;
  }

  const failedItems = [];
  for (let i = 0; i < Math.min(failed, 5); i++) {
    failedItems.push({
      id: uuid(),
      task_id: taskId,
      record_id: `REC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      record_type: 'USER_DATA',
      error_code: ['ERR_LOCKED', 'ERR_DEPENDENCY', 'ERR_PERMISSION'][Math.floor(Math.random() * 3)],
      error_message: ['记录被锁定', '存在依赖关系', '权限不足'][Math.floor(Math.random() * 3)],
      status: 'FAILED',
      failed_at: getNow()
    });
  }

  const successRate = processed / total;
  if (successRate < 0.5) {
    task.status = 'FAILED';
    task.error_message = '成功率低于50%，任务失败';
  } else if (failed > 0) {
    task.status = 'PARTIAL_COMPLETED';
    task.error_message = `部分记录删除失败，共 ${failed} 条`;
  } else {
    task.status = 'COMPLETED';
  }

  task.processed_records = processed;
  task.failed_records = failed;
  task.completed_at = getNow();

  failedItems.forEach(item => {
    db.failed_items.push(item);
  });

  updateRequestOverallStatus(task.request_id);

  saveDatabase();
  return task;
};

const updateRequestOverallStatus = (requestId) => {
  const tasks = db.execution_tasks.filter(t => t.request_id === requestId);
  if (tasks.length === 0) return;

  const allCompleted = tasks.every(t => t.status === 'COMPLETED');
  const allFinished = tasks.every(t => ['COMPLETED', 'PARTIAL_COMPLETED', 'FAILED'].includes(t.status));
  const hasPartial = tasks.some(t => t.status === 'PARTIAL_COMPLETED');
  const hasFailed = tasks.some(t => t.status === 'FAILED');

  const request = db.deletion_requests.find(r => r.id === requestId);
  if (request) {
    if (allCompleted) {
      request.status = 'COMPLETED';
    } else if (allFinished && hasFailed) {
      request.status = 'PARTIAL_COMPLETED';
    } else if (allFinished && hasPartial) {
      request.status = 'PARTIAL_COMPLETED';
    }
  }
};

const markRequestAsCompleted = (requestId, actor) => {
  const request = db.deletion_requests.find(r => r.id === requestId);
  if (!request) {
    throw new Error('删除申请不存在');
  }

  if (!['PARTIAL_COMPLETED', 'COMPLETED'].includes(request.status)) {
    throw new Error(`状态 ${request.status} 无法标记为完成`);
  }

  const beforeState = JSON.stringify({ status: request.status });
  request.status = 'COMPLETED';
  request.completed_at = getNow();
  request.updated_at = getNow();

  createAuditLog({
    requestId,
    action: 'MARK_COMPLETED',
    actor,
    beforeState,
    afterState: JSON.stringify({ status: 'COMPLETED' }),
    details: '手动标记删除申请为完成'
  });

  return getDeletionRequestById(requestId);
};

const retryFailedTask = (taskId, actor) => {
  const task = db.execution_tasks.find(t => t.id === taskId);
  if (!task) {
    throw new Error('执行任务不存在');
  }

  if (task.retry_count >= task.max_retries) {
    throw new Error(`已达到最大重试次数 (${task.max_retries})`);
  }

  task.status = 'RETRYING';
  task.retry_count += 1;
  task.error_message = null;

  db.failed_items
    .filter(f => f.task_id === taskId)
    .forEach(f => { f.status = 'RETRYING'; });

  createAuditLog({
    taskId,
    action: 'RETRY',
    actor,
    details: `重试任务，当前重试次数: ${task.retry_count}`
  });

  return executeTask(taskId, actor);
};

const getFailedItems = (taskId = null) => {
  if (taskId) {
    return db.failed_items.filter(f => f.task_id === taskId);
  }
  return db.failed_items;
};

const resolveFailedItem = (itemId, actor, resolution) => {
  const item = db.failed_items.find(f => f.id === itemId);
  if (item) {
    item.status = 'RESOLVED';
    item.resolved_at = getNow();
    
    createAuditLog({
      action: 'RESOLVE_FAILED_ITEM',
      actor,
      details: `处理失败项: ${resolution}`
    });
  }
  return item;
};

const createAuditLog = (data) => {
  const id = uuid();
  const log = {
    id,
    request_id: data.requestId || null,
    task_id: data.taskId || null,
    action: data.action,
    actor: data.actor,
    before_state: data.beforeState || null,
    after_state: data.afterState || null,
    details: data.details || null,
    created_at: getNow()
  };
  db.audit_logs.push(log);
  return id;
};

const getAuditLogs = (requestId = null) => {
  if (requestId) {
    return db.audit_logs.filter(l => l.request_id === requestId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return db.audit_logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
};

module.exports = {
  createDeletionRequest,
  getDeletionRequests,
  getAllDeletionRequests: getDeletionRequests,
  getDeletionRequestById,
  updateRequestStatus,
  markRequestAsCompleted,
  executeTask,
  retryFailedTask,
  getFailedItems,
  getFailedItemsByRequestId: (requestId) => db.failed_items.filter(f => {
    const task = db.execution_tasks.find(t => t.id === f.task_id);
    return task && task.request_id === requestId;
  }),
  resolveFailedItem,
  createAuditLog,
  getAuditLogs,
  getTasksByRequestId: (requestId) => db.execution_tasks.filter(t => t.request_id === requestId),
  generateRequestNo
};
