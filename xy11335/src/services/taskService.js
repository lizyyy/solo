const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { recordAudit } = require('../middleware/audit');

const VALID_STATUSES = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
const VALID_ROLES = ['nurse', 'accompanier', 'admin', 'system'];

const getTaskById = db.prepare('SELECT * FROM tasks WHERE id = ?');
const getMaxQueuePosition = db.prepare('SELECT MAX(queue_position) as max FROM tasks WHERE status NOT IN ("completed", "cancelled")');
const insertTask = db.prepare(`
  INSERT INTO tasks (
    id, patient_name, patient_id, department, inspection_type,
    estimated_time, status, assigned_to, created_by, created_at,
    queue_position, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateTaskStatus = db.prepare('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?');
const updateTaskAssigned = db.prepare('UPDATE tasks SET status = ?, assigned_to = ?, accepted_at = ?, updated_at = ? WHERE id = ?');
const updateTaskStarted = db.prepare('UPDATE tasks SET status = ?, started_at = ?, updated_at = ? WHERE id = ?');
const updateTaskCompleted = db.prepare('UPDATE tasks SET status = ?, completed_at = ?, actual_duration = ?, is_overtime = ?, overtime_reason = ?, updated_at = ? WHERE id = ?');
const updateTaskCancelled = db.prepare('UPDATE tasks SET status = ?, cancelled_at = ?, cancelled_by = ?, cancel_reason = ?, updated_at = ? WHERE id = ?');
const updateQueuePosition = db.prepare('UPDATE tasks SET queue_position = ?, updated_at = ? WHERE id = ?');
const shiftQueuePositions = db.prepare('UPDATE tasks SET queue_position = queue_position + 1, updated_at = ? WHERE queue_position >= ? AND status NOT IN ("completed", "cancelled") AND id != ?');

function validateOperator(operator, role) {
  if (!operator || typeof operator !== 'string' || operator.trim() === '') {
    throw new Error('操作人不能为空');
  }
  if (!role || !VALID_ROLES.includes(role)) {
    throw new Error('无效的角色类型');
  }
  return true;
}

function createTask(data, operator, role) {
  validateOperator(operator, role);

  const { patient_name, patient_id, department, inspection_type, estimated_time } = data;
  
  if (!patient_name || !patient_id || !department || !inspection_type || !estimated_time) {
    throw new Error('缺少必填字段');
  }

  const taskId = uuidv4();
  const now = Date.now();
  const maxResult = getMaxQueuePosition.get();
  const queuePosition = (maxResult?.max || 0) + 1;

  insertTask.run(
    taskId,
    patient_name,
    patient_id,
    department,
    inspection_type,
    estimated_time,
    'pending',
    null,
    operator,
    now,
    queuePosition,
    now
  );

  recordAudit(taskId, 'create', operator, role, null, 'pending', '创建陪检任务');

  return { id: taskId, queue_position: queuePosition };
}

function acceptTask(taskId, operator, role) {
  validateOperator(operator, role);

  const task = getTaskById.get(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }

  if (task.status !== 'pending') {
    throw new Error('只能接单待处理状态的任务');
  }

  const now = Date.now();
  updateTaskAssigned.run('accepted', operator, now, now, taskId);

  recordAudit(taskId, 'accept', operator, role, 'pending', 'accepted', '陪检员接单');

  return { success: true, taskId };
}

function startTask(taskId, operator, role) {
  validateOperator(operator, role);

  const task = getTaskById.get(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }

  if (task.status !== 'accepted') {
    throw new Error('只能开始已接单状态的任务');
  }

  if (task.assigned_to !== operator) {
    throw new Error('只能开始自己接单的任务');
  }

  const now = Date.now();
  updateTaskStarted.run('in_progress', now, now, taskId);

  recordAudit(taskId, 'start', operator, role, 'accepted', 'in_progress', '开始陪检');

  return { success: true, taskId };
}

function completeTask(taskId, operator, role, actualDuration, overtimeReason = null) {
  validateOperator(operator, role);

  const task = getTaskById.get(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }

  if (task.status !== 'in_progress') {
    throw new Error('只能完成进行中状态的任务');
  }

  if (task.assigned_to !== operator) {
    throw new Error('只能完成自己负责的任务');
  }

  const now = Date.now();
  const isOvertime = actualDuration > task.estimated_time;

  updateTaskCompleted.run('completed', now, actualDuration, isOvertime ? 1 : 0, overtimeReason, now, taskId);

  recordAudit(taskId, 'complete', operator, role, 'in_progress', 'completed', `完成陪检，实际用时${actualDuration}分钟`);

  if (isOvertime) {
    recordAudit(taskId, 'mark_overtime', '系统', 'system', 'in_progress', 'completed', overtimeReason || '陪检超时', 'OVERTIME', '陪检超时');
  }

  return { success: true, taskId, is_overtime: isOvertime };
}

function cancelTask(taskId, operator, role, reason) {
  validateOperator(operator, role);

  const task = getTaskById.get(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }

  if (task.status === 'completed' || task.status === 'cancelled') {
    throw new Error('该状态的任务无法取消');
  }

  const now = Date.now();
  const oldStatus = task.status;

  updateTaskCancelled.run('cancelled', now, operator, reason, now, taskId);

  recordAudit(taskId, 'cancel', operator, role, oldStatus, 'cancelled', reason);

  return { success: true, taskId };
}

function jumpQueue(taskId, operator, role, targetPosition) {
  validateOperator(operator, role);

  const task = getTaskById.get(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }

  if (task.status === 'completed' || task.status === 'cancelled') {
    throw new Error('该状态的任务无法插队');
  }

  const now = Date.now();
  const oldPosition = task.queue_position;

  if (targetPosition < oldPosition) {
    shiftQueuePositions.run(now, targetPosition, taskId);
  }

  updateQueuePosition.run(targetPosition, now, taskId);

  recordAudit(taskId, 'jump_queue', operator, role, task.status, task.status, `从位置${oldPosition}插队到位置${targetPosition}`);

  return { success: true, taskId, old_position: oldPosition, new_position: targetPosition };
}

function getTaskDetail(taskId) {
  const task = getTaskById.get(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }

  const audits = db.prepare('SELECT * FROM audit_logs WHERE task_id = ? ORDER BY created_at ASC').all(taskId);

  return { task, audits };
}

function listTasks(filters = {}) {
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.assigned_to) {
    query += ' AND assigned_to = ?';
    params.push(filters.assigned_to);
  }

  if (filters.created_by) {
    query += ' AND created_by = ?';
    params.push(filters.created_by);
  }

  if (filters.start_time) {
    query += ' AND created_at >= ?';
    params.push(parseInt(filters.start_time));
  }

  if (filters.end_time) {
    query += ' AND created_at <= ?';
    params.push(parseInt(filters.end_time));
  }

  if (filters.is_overtime !== undefined) {
    query += ' AND is_overtime = ?';
    params.push(filters.is_overtime ? 1 : 0);
  }

  query += ' ORDER BY queue_position ASC, created_at DESC';

  const tasks = db.prepare(query).all(...params);
  return tasks;
}

module.exports = {
  createTask,
  acceptTask,
  startTask,
  completeTask,
  cancelTask,
  jumpQueue,
  getTaskDetail,
  listTasks,
  validateOperator
};
