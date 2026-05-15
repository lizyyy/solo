const moment = require('moment');
const { getQuery, allQuery, runQuery, uuid } = require('../database');
const { applyDeletionRules } = require('./retentionService');

const generateRequestNo = () => {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DEL-${dateStr}-${random}`;
};

const createDeletionRequest = async (data) => {
  const id = uuid();
  const requestNo = generateRequestNo();
  
  await runQuery(
    `INSERT INTO deletion_requests 
     (id, request_no, customer_id, customer_name, reason, requested_by, status) 
     VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`,
    [id, requestNo, data.customerId, data.customerName, data.reason, data.requestedBy]
  );

  await createAuditLog({
    requestId: id,
    action: 'CREATED',
    actor: data.requestedBy,
    details: `创建删除申请 ${requestNo}`
  });

  return await getDeletionRequestById(id);
};

const getDeletionRequests = async (filters = {}) => {
  let sql = `SELECT dr.*, 
             (SELECT COUNT(*) FROM execution_tasks WHERE request_id = dr.id) as task_count,
             (SELECT COUNT(*) FROM execution_tasks WHERE request_id = dr.id AND status = 'COMPLETED') as completed_tasks,
             (SELECT COUNT(*) FROM execution_tasks WHERE request_id = dr.id AND status = 'FAILED') as failed_tasks
             FROM deletion_requests dr WHERE 1=1`;
  let params = [];

  if (filters.status) {
    sql += ' AND dr.status = ?';
    params.push(filters.status);
  }
  if (filters.customerId) {
    sql += ' AND dr.customer_id = ?';
    params.push(filters.customerId);
  }

  sql += ' ORDER BY dr.created_at DESC';
  
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return await allQuery(sql, params);
};

const getDeletionRequestById = async (id) => {
  const request = await getQuery(
    `SELECT dr.*, 
     (SELECT COUNT(*) FROM execution_tasks WHERE request_id = dr.id) as task_count,
     (SELECT COUNT(*) FROM execution_tasks WHERE request_id = dr.id AND status = 'COMPLETED') as completed_tasks,
     (SELECT COUNT(*) FROM execution_tasks WHERE request_id = dr.id AND status = 'FAILED') as failed_tasks
     FROM deletion_requests dr WHERE dr.id = ?`,
    [id]
  );

  if (request) {
    request.tasks = await allQuery(
      `SELECT et.*, dd.name as domain_name 
       FROM execution_tasks et 
       JOIN data_domains dd ON et.domain_id = dd.id 
       WHERE et.request_id = ?`,
      [id]
    );
  }

  return request;
};

const updateRequestStatus = async (requestId, newStatus, actor, additionalData = {}) => {
  const request = await getDeletionRequestById(requestId);
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
  let updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  let params = [newStatus];

  if (newStatus === 'APPROVED') {
    updateFields.push('approved_by = ?', 'approved_at = CURRENT_TIMESTAMP');
    params.push(actor);
  }
  if (newStatus === 'EXECUTING') {
    updateFields.push('executed_by = ?', 'executed_at = CURRENT_TIMESTAMP');
    params.push(actor);
  }
  if (newStatus === 'COMPLETED' || newStatus === 'CLOSED') {
    updateFields.push('completed_at = CURRENT_TIMESTAMP');
  }

  params.push(requestId);

  await runQuery(
    `UPDATE deletion_requests SET ${updateFields.join(', ')} WHERE id = ?`,
    params
  );

  await createAuditLog({
    requestId,
    action: `STATUS_${newStatus}`,
    actor,
    beforeState,
    afterState: JSON.stringify({ status: newStatus }),
    details: additionalData.details || `状态变更为 ${newStatus}`
  });

  if (newStatus === 'APPROVED') {
    await applyDeletionRules(requestId);
  }

  return await getDeletionRequestById(requestId);
};

const executeTask = async (taskId, actor) => {
  const task = await getQuery('SELECT * FROM execution_tasks WHERE id = ?', [taskId]);
  if (!task) {
    throw new Error('执行任务不存在');
  }

  if (task.status !== 'PENDING' && task.status !== 'RETRYING') {
    throw new Error(`任务状态 ${task.status} 不可执行`);
  }

  await runQuery(
    `UPDATE execution_tasks SET status = 'EXECUTING', started_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [taskId]
  );

  const result = await simulateTaskExecution(task);

  await runQuery(
    `UPDATE execution_tasks 
     SET status = ?, processed_records = ?, failed_records = ?, 
         completed_at = CURRENT_TIMESTAMP, error_message = ?
     WHERE id = ?`,
    [result.status, result.processed, result.failed, result.errorMessage, taskId]
  );

  if (result.failedItems && result.failedItems.length > 0) {
    for (const item of result.failedItems) {
      await runQuery(
        `INSERT INTO failed_items (id, task_id, record_id, record_type, error_code, error_message)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuid(), taskId, item.recordId, item.recordType, item.errorCode, item.errorMessage]
      );
    }
  }

  await updateRequestOverallStatus(task.request_id);

  return await getQuery('SELECT * FROM execution_tasks WHERE id = ?', [taskId]);
};

const simulateTaskExecution = async (task) => {
  const total = task.total_records;
  const processed = Math.floor(total * (0.85 + Math.random() * 0.1));
  const failed = total - processed;

  const failedItems = [];
  for (let i = 0; i < Math.min(failed, 5); i++) {
    failedItems.push({
      recordId: `REC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      recordType: 'USER_DATA',
      errorCode: ['ERR_LOCKED', 'ERR_DEPENDENCY', 'ERR_PERMISSION'][Math.floor(Math.random() * 3)],
      errorMessage: ['记录被锁定', '存在依赖关系', '权限不足'][Math.floor(Math.random() * 3)]
    });
  }

  const successRate = processed / total;
  let status = 'COMPLETED';
  let errorMessage = null;

  if (successRate < 0.5) {
    status = 'FAILED';
    errorMessage = '成功率低于50%，任务失败';
  } else if (failed > 0) {
    status = 'PARTIAL_COMPLETED';
    errorMessage = `部分记录删除失败，共 ${failed} 条`;
  }

  return { status, processed, failed, failedItems, errorMessage };
};

const updateRequestOverallStatus = async (requestId) => {
  const tasks = await allQuery('SELECT * FROM execution_tasks WHERE request_id = ?', [requestId]);
  
  const allCompleted = tasks.every(t => t.status === 'COMPLETED');
  const anyFailed = tasks.some(t => t.status === 'FAILED');
  const allFinished = tasks.every(t => ['COMPLETED', 'PARTIAL_COMPLETED', 'FAILED'].includes(t.status));

  if (allCompleted) {
    await runQuery('UPDATE deletion_requests SET status = ? WHERE id = ?', ['COMPLETED', requestId]);
  } else if (allFinished && anyFailed) {
    await runQuery('UPDATE deletion_requests SET status = ? WHERE id = ?', ['PARTIAL_COMPLETED', requestId]);
  }
};

const retryFailedTask = async (taskId, actor) => {
  const task = await getQuery('SELECT * FROM execution_tasks WHERE id = ?', [taskId]);
  if (!task) {
    throw new Error('执行任务不存在');
  }

  if (task.retry_count >= task.max_retries) {
    throw new Error(`已达到最大重试次数 (${task.max_retries})`);
  }

  await runQuery(
    `UPDATE execution_tasks 
     SET status = 'RETRYING', retry_count = retry_count + 1, error_message = NULL 
     WHERE id = ?`,
    [taskId]
  );

  await runQuery(`UPDATE failed_items SET status = 'RETRYING' WHERE task_id = ?`, [taskId]);

  await createAuditLog({
    taskId,
    action: 'RETRY',
    actor,
    details: `重试任务，当前重试次数: ${task.retry_count + 1}`
  });

  return await executeTask(taskId, actor);
};

const getFailedItems = async (taskId = null) => {
  let sql = `SELECT fi.*, et.request_id, dd.name as domain_name 
             FROM failed_items fi 
             JOIN execution_tasks et ON fi.task_id = et.id 
             JOIN data_domains dd ON et.domain_id = dd.id WHERE 1=1`;
  let params = [];

  if (taskId) {
    sql += ' AND fi.task_id = ?';
    params.push(taskId);
  }

  sql += ' ORDER BY fi.failed_at DESC';
  return await allQuery(sql, params);
};

const resolveFailedItem = async (itemId, actor, resolution) => {
  await runQuery(
    `UPDATE failed_items 
     SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [itemId]
  );

  await createAuditLog({
    action: 'RESOLVE_FAILED_ITEM',
    actor,
    details: `处理失败项: ${resolution}`
  });

  return await getQuery('SELECT * FROM failed_items WHERE id = ?', [itemId]);
};

const createAuditLog = async (data) => {
  const id = uuid();
  await runQuery(
    `INSERT INTO audit_logs (id, request_id, task_id, action, actor, before_state, after_state, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.requestId || null, data.taskId || null, data.action, data.actor, 
     data.beforeState || null, data.afterState || null, data.details || null]
  );
  return id;
};

const getAuditLogs = async (requestId = null) => {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  let params = [];

  if (requestId) {
    sql += ' AND request_id = ?';
    params.push(requestId);
  }

  sql += ' ORDER BY created_at DESC';
  return await allQuery(sql, params);
};

module.exports = {
  createDeletionRequest,
  getDeletionRequests,
  getDeletionRequestById,
  updateRequestStatus,
  executeTask,
  retryFailedTask,
  getFailedItems,
  resolveFailedItem,
  createAuditLog,
  getAuditLogs,
  generateRequestNo
};
