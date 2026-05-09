const { runQuery, getQuery, allQuery } = require('../database');
const { generateId, getCurrentTime, createError, validateRequiredFields } = require('../utils/helpers');
const { METER_TASK_STATUSES, APPLICATION_STATUSES, OPERATION_TYPES, ERROR_CODES } = require('../utils/constants');
const applicationService = require('./applicationService');
const logService = require('./logService');

async function createMeterTask(applicationId, data, operator = 'system') {
  const application = await applicationService.getApplicationById(applicationId);
  
  if (application.status !== APPLICATION_STATUSES.APPROVED) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `申请单状态为 ${application.status}，只有已批准状态才能创建电表任务`
    );
  }
  
  const validationError = validateRequiredFields(data, ['task_type', 'install_address']);
  if (validationError) {
    throw validationError;
  }
  
  const existingTask = await getQuery(
    'SELECT * FROM meter_tasks WHERE application_id = ? AND status NOT IN ("INSTALLED", "CANCELLED")',
    [applicationId]
  );
  
  if (existingTask) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `该申请单已存在进行中的电表任务 (ID: ${existingTask.id})`
    );
  }
  
  const id = generateId();
  const currentTime = getCurrentTime();
  
  await runQuery(
    `INSERT INTO meter_tasks (id, application_id, task_type, install_address, meter_type, installer, status, create_time, update_time, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      applicationId,
      data.task_type,
      data.install_address,
      data.meter_type || null,
      data.installer || null,
      METER_TASK_STATUSES.PENDING,
      currentTime,
      currentTime,
      data.remark || null
    ]
  );
  
  await applicationService.updateApplicationStatus(
    applicationId,
    APPLICATION_STATUSES.PENDING_METER,
    operator,
    '已创建电表安装任务'
  );
  
  const newTask = await getQuery('SELECT * FROM meter_tasks WHERE id = ?', [id]);
  
  await logService.createLog(
    applicationId,
    OPERATION_TYPES.METER_INSTALL,
    operator,
    null,
    { meterTaskId: id, taskType: data.task_type },
    '电表安装任务已创建'
  );
  
  return newTask;
}

async function getMeterTaskById(id) {
  const task = await getQuery('SELECT * FROM meter_tasks WHERE id = ?', [id]);
  
  if (!task) {
    throw createError(ERROR_CODES.NOT_FOUND, '电表任务不存在');
  }
  
  return task;
}

async function getMeterTasksByApplication(applicationId) {
  return await allQuery(
    'SELECT * FROM meter_tasks WHERE application_id = ? ORDER BY create_time DESC',
    [applicationId]
  );
}

async function scheduleMeterTask(id, installer = null, operator = 'system') {
  const task = await getMeterTaskById(id);
  
  if (task.status !== METER_TASK_STATUSES.PENDING) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `电表任务当前状态为 ${task.status}，无法安排`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = task.version + 1;
  
  await runQuery(
    `UPDATE meter_tasks SET installer = ?, status = ?, update_time = ?, version = ?
     WHERE id = ? AND version = ?`,
    [installer, METER_TASK_STATUSES.SCHEDULED, currentTime, newVersion, id, task.version]
  );
  
  await logService.createLog(
    task.application_id,
    OPERATION_TYPES.METER_INSTALL,
    operator,
    { status: task.status },
    { status: METER_TASK_STATUSES.SCHEDULED, installer },
    '电表安装任务已安排'
  );
  
  return await getMeterTaskById(id);
}

async function completeMeterTask(id, meterType = null, operator = 'system') {
  const task = await getMeterTaskById(id);
  
  if (task.status !== METER_TASK_STATUSES.SCHEDULED) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `电表任务当前状态为 ${task.status}，无法完成`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = task.version + 1;
  
  await runQuery(
    `UPDATE meter_tasks SET meter_type = ?, install_time = ?, status = ?, update_time = ?, version = ?
     WHERE id = ? AND version = ?`,
    [meterType, currentTime, METER_TASK_STATUSES.INSTALLED, currentTime, newVersion, id, task.version]
  );
  
  await applicationService.updateApplicationStatus(
    task.application_id,
    APPLICATION_STATUSES.METER_INSTALLED,
    operator,
    '电表安装已完成'
  );
  
  await logService.createLog(
    task.application_id,
    OPERATION_TYPES.METER_INSTALL,
    operator,
    { status: task.status },
    { status: METER_TASK_STATUSES.INSTALLED },
    '电表安装已完成'
  );
  
  return await getMeterTaskById(id);
}

async function cancelMeterTask(id, reason = null, operator = 'system') {
  const task = await getMeterTaskById(id);
  
  if ([METER_TASK_STATUSES.INSTALLED, METER_TASK_STATUSES.CANCELLED].includes(task.status)) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `电表任务当前状态为 ${task.status}，无法取消`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = task.version + 1;
  
  await runQuery(
    `UPDATE meter_tasks SET status = ?, update_time = ?, version = ?, remark = ?
     WHERE id = ? AND version = ?`,
    [METER_TASK_STATUSES.CANCELLED, currentTime, newVersion, reason || task.remark, id, task.version]
  );
  
  await logService.createLog(
    task.application_id,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: task.status },
    { status: METER_TASK_STATUSES.CANCELLED },
    reason || '电表任务已取消'
  );
  
  return await getMeterTaskById(id);
}

async function failMeterTask(id, reason = null, operator = 'system') {
  const task = await getMeterTaskById(id);
  
  if ([METER_TASK_STATUSES.INSTALLED, METER_TASK_STATUSES.CANCELLED, METER_TASK_STATUSES.FAILED].includes(task.status)) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `电表任务当前状态为 ${task.status}，无法标记失败`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = task.version + 1;
  
  await runQuery(
    `UPDATE meter_tasks SET status = ?, update_time = ?, version = ?, remark = ?
     WHERE id = ? AND version = ?`,
    [METER_TASK_STATUSES.FAILED, currentTime, newVersion, reason || task.remark, id, task.version]
  );
  
  await logService.createLog(
    task.application_id,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: task.status },
    { status: METER_TASK_STATUSES.FAILED },
    reason || '电表任务执行失败'
  );
  
  return await getMeterTaskById(id);
}

module.exports = {
  createMeterTask,
  getMeterTaskById,
  getMeterTasksByApplication,
  scheduleMeterTask,
  completeMeterTask,
  cancelMeterTask,
  failMeterTask
};
