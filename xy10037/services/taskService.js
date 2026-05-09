const { v4: uuidv4 } = require('uuid');
const db = require('../database/connection');
const config = require('../config');
const { TASK_STATUS } = require('../database/schema');
const { 
  NotFoundError, 
  ConcurrencyError, 
  ValidationError,
  StateTransitionError 
} = require('../middleware/response');
const { logAudit, AUDIT_ACTIONS, MODULES } = require('../middleware/audit');

const STATE_TRANSITIONS = {
  [TASK_STATUS.PENDING]: [TASK_STATUS.IN_PROGRESS, TASK_STATUS.CANCELLED],
  [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED],
  [TASK_STATUS.FAILED]: [TASK_STATUS.IN_PROGRESS, TASK_STATUS.CANCELLED],
  [TASK_STATUS.COMPLETED]: [],
  [TASK_STATUS.CANCELLED]: []
};

function validateStateTransition(fromStatus, toStatus) {
  const allowedTransitions = STATE_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

function generateTaskNo() {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `FU${dateStr}${random}`;
}

function validateTaskData(data, isCreate = true) {
  const errors = [];
  
  if (isCreate) {
    if (!data.customer_name || data.customer_name.trim() === '') {
      errors.push('客户姓名不能为空');
    }
    if (!data.promised_action || data.promised_action.trim() === '') {
      errors.push('承诺动作不能为空');
    }
    if (!data.problem_type || data.problem_type.trim() === '') {
      errors.push('问题类型不能为空');
    }
  }
  
  if (data.priority && !['low', 'normal', 'high', 'urgent'].includes(data.priority)) {
    errors.push('优先级无效');
  }
  
  if (errors.length > 0) {
    throw new ValidationError(errors.join('; '));
  }
}

async function createTask(data, operator) {
  validateTaskData(data, true);
  
  const now = Date.now();
  const taskId = uuidv4();
  const taskNo = generateTaskNo();
  
  const task = {
    id: taskId,
    task_no: taskNo,
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone || null,
    customer_account: data.customer_account || null,
    problem_type: data.problem_type.trim(),
    description: data.description || null,
    promised_action: data.promised_action.trim(),
    status: TASK_STATUS.PENDING,
    priority: data.priority || 'normal',
    assignee: data.assignee || null,
    created_by: operator,
    created_at: now,
    updated_at: now,
    due_at: data.due_at ? new Date(data.due_at).getTime() : null,
    version: 1,
    retry_count: 0,
    is_deleted: 0
  };
  
  await db.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO tasks 
       (id, task_no, customer_name, customer_phone, customer_account, problem_type, 
        description, promised_action, status, priority, assignee, created_by, 
        created_at, updated_at, due_at, version, retry_count, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id, task.task_no, task.customer_name, task.customer_phone, task.customer_account,
        task.problem_type, task.description, task.promised_action, task.status,
        task.priority, task.assignee, task.created_by, task.created_at, task.updated_at,
        task.due_at, task.version, task.retry_count, task.is_deleted
      ]
    );
    
    await tx.run(
      `INSERT INTO task_transitions (id, task_id, from_status, to_status, operator, remark, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`,
      [uuidv4(), task.id, task.status, operator, '创建任务', now]
    );
  });
  
  return getTaskById(taskId);
}

async function getTaskById(taskId) {
  const task = await db.get(
    'SELECT * FROM tasks WHERE id = ? AND is_deleted = 0',
    [taskId]
  );
  
  if (!task) {
    throw new NotFoundError('任务不存在');
  }
  
  return task;
}

async function getTaskList(filter = {}, page = 1, pageSize = 20) {
  const conditions = ['is_deleted = 0'];
  const params = [];
  
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter.assignee) {
    conditions.push('assignee = ?');
    params.push(filter.assignee);
  }
  if (filter.created_by) {
    conditions.push('created_by = ?');
    params.push(filter.created_by);
  }
  if (filter.keyword) {
    conditions.push('(customer_name LIKE ? OR task_no LIKE ? OR customer_phone LIKE ?)');
    const keyword = `%${filter.keyword}%`;
    params.push(keyword, keyword, keyword);
  }
  if (filter.problem_type) {
    conditions.push('problem_type = ?');
    params.push(filter.problem_type);
  }
  if (filter.startTime) {
    conditions.push('created_at >= ?');
    params.push(filter.startTime);
  }
  if (filter.endTime) {
    conditions.push('created_at <= ?');
    params.push(filter.endTime);
  }
  
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT * FROM tasks ${whereClause} ORDER BY 
    CASE priority 
      WHEN 'urgent' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      WHEN 'low' THEN 4 
      ELSE 5 
    END ASC, created_at DESC`;
  
  return db.allPaged(sql, params, page, pageSize);
}

async function updateTask(taskId, data, operator, expectedVersion) {
  const task = await getTaskById(taskId);
  
  if (expectedVersion !== undefined && expectedVersion !== null) {
    if (task.version !== expectedVersion) {
      throw new ConcurrencyError();
    }
  }
  
  validateTaskData(data, false);
  
  const now = Date.now();
  const updates = [];
  const params = [];
  
  const allowedFields = [
    'customer_name', 'customer_phone', 'customer_account',
    'problem_type', 'description', 'promised_action',
    'priority', 'assignee', 'due_at'
  ];
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(data[field]);
    }
  }
  
  updates.push('updated_at = ?');
  params.push(now);
  updates.push('version = version + 1');
  
  params.push(taskId);
  params.push(task.version);
  
  const result = await db.run(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND version = ?`,
    params
  );
  
  if (result.changes === 0) {
    throw new ConcurrencyError();
  }
  
  return getTaskById(taskId);
}

async function changeStatus(taskId, newStatus, operator, remark = null, expectedVersion = null) {
  const task = await getTaskById(taskId);
  
  if (task.status === newStatus) {
    return task;
  }
  
  if (!validateStateTransition(task.status, newStatus)) {
    throw new StateTransitionError(`无法从 ${getStatusText(task.status)} 转换到 ${getStatusText(newStatus)}`);
  }
  
  if (expectedVersion !== null && expectedVersion !== undefined) {
    if (task.version !== expectedVersion) {
      throw new ConcurrencyError();
    }
  }
  
  const now = Date.now();
  
  const result = await db.transaction(async (tx) => {
    const updateResult = await tx.run(
      `UPDATE tasks 
       SET status = ?, updated_at = ?, version = version + 1
       WHERE id = ? AND version = ?`,
      [newStatus, now, taskId, task.version]
    );
    
    if (updateResult.changes === 0) {
      throw new ConcurrencyError();
    }
    
    await tx.run(
      `INSERT INTO task_transitions (id, task_id, from_status, to_status, operator, remark, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, task.status, newStatus, operator, remark, now]
    );
    
    return updateResult;
  });
  
  return getTaskById(taskId);
}

async function startTask(taskId, operator, expectedVersion = null) {
  return changeStatus(taskId, TASK_STATUS.IN_PROGRESS, operator, '开始处理', expectedVersion);
}

async function completeTask(taskId, operator, remark = null, expectedVersion = null) {
  const now = Date.now();
  
  const task = await changeStatus(taskId, TASK_STATUS.COMPLETED, operator, remark, expectedVersion);
  
  await db.run(
    'UPDATE tasks SET completed_at = ? WHERE id = ?',
    [now, taskId]
  );
  
  return getTaskById(taskId);
}

async function failTask(taskId, operator, errorMessage = null, expectedVersion = null) {
  const now = Date.now();
  const task = await getTaskById(taskId);
  
  if (task.status !== TASK_STATUS.IN_PROGRESS && task.status !== TASK_STATUS.PENDING) {
    throw new StateTransitionError('只有待处理或进行中的任务才能标记为失败');
  }
  
  const result = await db.transaction(async (tx) => {
    const updateResult = await tx.run(
      `UPDATE tasks 
       SET status = ?, updated_at = ?, last_error = ?, retry_count = retry_count + 1, version = version + 1
       WHERE id = ? AND version = ?`,
      [TASK_STATUS.FAILED, now, errorMessage, taskId, task.version]
    );
    
    if (updateResult.changes === 0) {
      throw new ConcurrencyError();
    }
    
    await tx.run(
      `INSERT INTO task_transitions (id, task_id, from_status, to_status, operator, remark, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, task.status, TASK_STATUS.FAILED, operator, errorMessage, now]
    );
    
    await tx.run(
      `INSERT INTO failed_tasks 
       (id, task_id, error_message, retry_count, next_retry_at, status, created_at)
       VALUES (?, ?, ?, 0, ?, 'pending', ?)`,
      [uuidv4(), taskId, errorMessage, now + config.RETRY_DELAY_BASE, now]
    );
    
    return updateResult;
  });
  
  return getTaskById(taskId);
}

async function retryTask(taskId, operator, expectedVersion = null) {
  const task = await getTaskById(taskId);
  
  if (task.status !== TASK_STATUS.FAILED) {
    throw new StateTransitionError('只有失败的任务才能重试');
  }
  
  if (task.retry_count >= config.MAX_RETRY_COUNT) {
    throw new StateTransitionError(`已达到最大重试次数(${config.MAX_RETRY_COUNT})`);
  }
  
  const now = Date.now();
  
  const result = await db.transaction(async (tx) => {
    const updateResult = await tx.run(
      `UPDATE tasks 
       SET status = ?, updated_at = ?, version = version + 1
       WHERE id = ? AND status = ?`,
      [TASK_STATUS.IN_PROGRESS, now, taskId, TASK_STATUS.FAILED]
    );
    
    if (updateResult.changes === 0) {
      throw new ConcurrencyError();
    }
    
    await tx.run(
      `INSERT INTO task_transitions (id, task_id, from_status, to_status, operator, remark, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), taskId, TASK_STATUS.FAILED, TASK_STATUS.IN_PROGRESS, operator, '重试任务', now]
    );
    
    await tx.run(
      `UPDATE failed_tasks 
       SET retry_count = retry_count + 1, last_retry_at = ?, status = 'retrying'
       WHERE task_id = ? AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [now, taskId]
    );
    
    return updateResult;
  });
  
  return getTaskById(taskId);
}

async function cancelTask(taskId, operator, reason = null, expectedVersion = null) {
  return changeStatus(taskId, TASK_STATUS.CANCELLED, operator, reason || '取消任务', expectedVersion);
}

async function assignTask(taskId, assignee, operator, expectedVersion = null) {
  return updateTask(taskId, { assignee }, operator, expectedVersion);
}

async function deleteTask(taskId, operator) {
  const task = await getTaskById(taskId);
  const now = Date.now();
  
  await db.run(
    'UPDATE tasks SET is_deleted = 1, updated_at = ? WHERE id = ?',
    [now, taskId]
  );
  
  await logAudit({
    action: AUDIT_ACTIONS.TASK_DELETE,
    module: MODULES.TASK,
    targetId: taskId,
    operator
  });
  
  return { id: taskId, deleted: true };
}

async function getTaskTransitions(taskId) {
  return db.all(
    `SELECT * FROM task_transitions 
     WHERE task_id = ? 
     ORDER BY created_at DESC`,
    [taskId]
  );
}

async function getTaskStatistics() {
  const stats = await db.all(
    `SELECT status, COUNT(*) as count 
     FROM tasks 
     WHERE is_deleted = 0 
     GROUP BY status`
  );
  
  const result = {
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  };
  
  for (const stat of stats) {
    result[stat.status] = stat.count;
    result.total += stat.count;
  }
  
  const overdue = await db.get(
    `SELECT COUNT(*) as count 
     FROM tasks 
     WHERE is_deleted = 0 
       AND status NOT IN ('completed', 'cancelled')
       AND due_at IS NOT NULL 
       AND due_at < ?`,
    [Date.now()]
  );
  result.overdue = overdue.count;
  
  return result;
}

function getStatusText(status) {
  const statusMap = {
    [TASK_STATUS.PENDING]: '待处理',
    [TASK_STATUS.IN_PROGRESS]: '处理中',
    [TASK_STATUS.COMPLETED]: '已完成',
    [TASK_STATUS.FAILED]: '失败',
    [TASK_STATUS.CANCELLED]: '已取消'
  };
  return statusMap[status] || status;
}

function getPriorityText(priority) {
  const priorityMap = {
    'low': '低',
    'normal': '普通',
    'high': '高',
    'urgent': '紧急'
  };
  return priorityMap[priority] || priority;
}

module.exports = {
  TASK_STATUS,
  STATE_TRANSITIONS,
  createTask,
  getTaskById,
  getTaskList,
  updateTask,
  changeStatus,
  startTask,
  completeTask,
  failTask,
  retryTask,
  cancelTask,
  assignTask,
  deleteTask,
  getTaskTransitions,
  getTaskStatistics,
  getStatusText,
  getPriorityText,
  validateStateTransition
};
