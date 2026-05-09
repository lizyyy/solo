const { runQuery, getQuery, allQuery } = require('../database');
const { generateId, getCurrentTime, createError, validateRequiredFields, isValidStatus } = require('../utils/helpers');
const { APPLICATION_STATUSES, OPERATION_TYPES, ERROR_CODES, VALIDATION_MESSAGES } = require('../utils/constants');
const logService = require('./logService');

const STATUS_TRANSITIONS = {
  [APPLICATION_STATUSES.SUBMITTED]: [APPLICATION_STATUSES.PENDING_SURVEY, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.PENDING_SURVEY]: [APPLICATION_STATUSES.SURVEY_COMPLETED, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.SURVEY_COMPLETED]: [APPLICATION_STATUSES.PENDING_APPROVAL, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.PENDING_APPROVAL]: [APPLICATION_STATUSES.APPROVAL_IN_PROGRESS, APPLICATION_STATUSES.PENDING_SUPPLEMENT, APPLICATION_STATUSES.REJECTED, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.APPROVAL_IN_PROGRESS]: [APPLICATION_STATUSES.APPROVED, APPLICATION_STATUSES.PENDING_SUPPLEMENT, APPLICATION_STATUSES.REJECTED, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.PENDING_SUPPLEMENT]: [APPLICATION_STATUSES.SUPPLEMENT_SUBMITTED, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.SUPPLEMENT_SUBMITTED]: [APPLICATION_STATUSES.PENDING_APPROVAL, APPLICATION_STATUSES.REJECTED, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.APPROVED]: [APPLICATION_STATUSES.PENDING_METER, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.PENDING_METER]: [APPLICATION_STATUSES.METER_INSTALLED, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.METER_INSTALLED]: [APPLICATION_STATUSES.GRID_CONNECTED, APPLICATION_STATUSES.CANCELLED],
  [APPLICATION_STATUSES.REJECTED]: [],
  [APPLICATION_STATUSES.CANCELLED]: [],
  [APPLICATION_STATUSES.GRID_CONNECTED]: []
};

function canTransition(fromStatus, toStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
  return allowedTransitions.includes(toStatus);
}

async function createApplication(data, operator = 'system') {
  const validationError = validateRequiredFields(data, ['applicant_name', 'contact_phone', 'address', 'pv_capacity']);
  if (validationError) {
    throw validationError;
  }
  
  const id = generateId();
  const currentTime = getCurrentTime();
  
  await runQuery(
    `INSERT INTO applications (id, applicant_name, contact_phone, address, pv_capacity, status, submit_time, update_time, remark, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.applicant_name, data.contact_phone, data.address, data.pv_capacity, APPLICATION_STATUSES.SUBMITTED, currentTime, currentTime, data.remark || null, 1]
  );
  
  const newApplication = await getQuery('SELECT * FROM applications WHERE id = ?', [id]);
  
  await logService.createLog(
    id,
    OPERATION_TYPES.APPLICATION_SUBMIT,
    operator,
    null,
    { status: newApplication.status },
    `申请单已创建，申请人: ${data.applicant_name}`
  );
  
  return newApplication;
}

async function getApplicationById(id) {
  const application = await getQuery('SELECT * FROM applications WHERE id = ? AND is_deleted = 0', [id]);
  
  if (!application) {
    throw createError(ERROR_CODES.NOT_FOUND, VALIDATION_MESSAGES.NOT_FOUND);
  }
  
  return application;
}

async function getAllApplications(status = null, limit = 100, offset = 0) {
  let sql = 'SELECT * FROM applications WHERE is_deleted = 0';
  const params = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY update_time DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  return await allQuery(sql, params);
}

async function updateApplicationStatus(id, newStatus, operator = 'system', remark = null, force = false) {
  const application = await getApplicationById(id);
  
  if (!force && !canTransition(application.status, newStatus)) {
    throw createError(
      ERROR_CODES.CONFLICT,
      VALIDATION_MESSAGES.INVALID_TRANSITION(application.status, newStatus)
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = application.version + 1;
  
  await runQuery(
    `UPDATE applications SET status = ?, update_time = ?, remark = ?, version = ? WHERE id = ? AND version = ?`,
    [newStatus, currentTime, remark || application.remark, newVersion, id, application.version]
  );
  
  const updatedApplication = await getQuery(`SELECT * FROM applications WHERE id = ?`, [id]);
  
  await logService.createLog(
    id,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: application.status, version: application.version },
    { status: updatedApplication.status, version: updatedApplication.version },
    remark || `状态从 ${application.status} 变更为 ${newStatus}`
  );
  
  return updatedApplication;
}

async function manualCorrectApplication(id, updateData, operator = 'admin') {
  const application = await getApplicationById(id);
  
  const currentTime = getCurrentTime();
  const newVersion = application.version + 1;
  
  const updateFields = [];
  const updateValues = [];
  
  const allowedFields = ['applicant_name', 'contact_phone', 'address', 'pv_capacity', 'remark'];
  
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      updateValues.push(updateData[field]);
    }
  }
  
  updateFields.push('update_time = ?');
  updateValues.push(currentTime);
  
  updateFields.push('version = ?');
  updateValues.push(newVersion);
  
  updateValues.push(id);
  updateValues.push(application.version);
  
  if (updateFields.length <= 2) {
    throw createError(ERROR_CODES.BAD_REQUEST, '没有提供需要更新的字段');
  }
  
  const sql = `UPDATE applications SET ${updateFields.join(', ')} WHERE id = ? AND version = ?`;
  
  await runQuery(sql, updateValues);
  
  const correctedApplication = await getQuery(`SELECT * FROM applications WHERE id = ?`, [id]);
  
  await logService.createLog(
    id,
    OPERATION_TYPES.MANUAL_CORRECTION,
    operator,
    {
      applicant_name: application.applicant_name,
      contact_phone: application.contact_phone,
      address: application.address,
      pv_capacity: application.pv_capacity,
      remark: application.remark
    },
    {
      applicant_name: correctedApplication.applicant_name,
      contact_phone: correctedApplication.contact_phone,
      address: correctedApplication.address,
      pv_capacity: correctedApplication.pv_capacity,
      remark: correctedApplication.remark
    },
    '人工修正申请单信息'
  );
  
  return correctedApplication;
}

async function deleteApplication(id, operator = 'admin') {
  const application = await getApplicationById(id);
  
  const currentTime = getCurrentTime();
  
  await runQuery(
    `UPDATE applications SET is_deleted = 1, update_time = ? WHERE id = ?`,
    [currentTime, id]
  );
  
  await logService.createLog(
    id,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: application.status },
    { status: 'DELETED' },
    '申请单已删除'
  );
  
  return { success: true, id };
}

async function getApplicationSummary(id) {
  const application = await getApplicationById(id);
  
  return {
    application,
    statusText: getStatusText(application.status),
    nextPossibleStatuses: STATUS_TRANSITIONS[application.status] || []
  };
}

function getStatusText(status) {
  const statusMap = {
    [APPLICATION_STATUSES.SUBMITTED]: '已提交',
    [APPLICATION_STATUSES.PENDING_SURVEY]: '待勘察',
    [APPLICATION_STATUSES.SURVEY_COMPLETED]: '勘察完成',
    [APPLICATION_STATUSES.PENDING_APPROVAL]: '待审批',
    [APPLICATION_STATUSES.APPROVAL_IN_PROGRESS]: '审批中',
    [APPLICATION_STATUSES.APPROVED]: '已批准',
    [APPLICATION_STATUSES.REJECTED]: '已驳回',
    [APPLICATION_STATUSES.PENDING_METER]: '待装表',
    [APPLICATION_STATUSES.METER_INSTALLED]: '装表完成',
    [APPLICATION_STATUSES.PENDING_SUPPLEMENT]: '待补材料',
    [APPLICATION_STATUSES.SUPPLEMENT_SUBMITTED]: '材料已提交',
    [APPLICATION_STATUSES.GRID_CONNECTED]: '已并网',
    [APPLICATION_STATUSES.CANCELLED]: '已取消'
  };
  
  return statusMap[status] || status;
}

module.exports = {
  createApplication,
  getApplicationById,
  getAllApplications,
  updateApplicationStatus,
  manualCorrectApplication,
  deleteApplication,
  getApplicationSummary,
  canTransition,
  STATUS_TRANSITIONS,
  getStatusText
};
