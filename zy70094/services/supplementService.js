const { runQuery, getQuery, allQuery } = require('../database');
const { generateId, getCurrentTime, createError, validateRequiredFields } = require('../utils/helpers');
const { SUPPLEMENT_STATUSES, APPLICATION_STATUSES, OPERATION_TYPES, ERROR_CODES } = require('../utils/constants');
const applicationService = require('./applicationService');
const logService = require('./logService');

async function createSupplement(applicationId, data, operator = 'system') {
  const application = await applicationService.getApplicationById(applicationId);
  
  const validationError = validateRequiredFields(data, ['missing_materials']);
  if (validationError) {
    throw validationError;
  }
  
  const existingSupplement = await getQuery(
    'SELECT * FROM supplements WHERE application_id = ? AND status = "PENDING"',
    [applicationId]
  );
  
  if (existingSupplement) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `该申请单已存在待处理的材料补正任务 (ID: ${existingSupplement.id})`
    );
  }
  
  const id = generateId();
  const currentTime = getCurrentTime();
  
  await runQuery(
    `INSERT INTO supplements (id, application_id, missing_materials, submit_deadline, status, create_time, update_time, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      applicationId,
      JSON.stringify(data.missing_materials),
      data.submit_deadline || null,
      SUPPLEMENT_STATUSES.PENDING,
      currentTime,
      currentTime,
      data.remark || null
    ]
  );
  
  if (application.status !== APPLICATION_STATUSES.PENDING_SUPPLEMENT) {
    await applicationService.updateApplicationStatus(
      applicationId,
      APPLICATION_STATUSES.PENDING_SUPPLEMENT,
      operator,
      '需要补充材料'
    );
  }
  
  const newSupplement = await getQuery('SELECT * FROM supplements WHERE id = ?', [id]);
  
  await logService.createLog(
    applicationId,
    OPERATION_TYPES.SUPPLEMENT_REQUEST,
    operator,
    null,
    { supplementId: id, missingMaterials: data.missing_materials },
    '材料补正通知已创建'
  );
  
  return {
    ...newSupplement,
    missing_materials: JSON.parse(newSupplement.missing_materials)
  };
}

async function getSupplementById(id) {
  const supplement = await getQuery('SELECT * FROM supplements WHERE id = ?', [id]);
  
  if (!supplement) {
    throw createError(ERROR_CODES.NOT_FOUND, '材料补正任务不存在');
  }
  
  return {
    ...supplement,
    missing_materials: JSON.parse(supplement.missing_materials),
    submitted_materials: supplement.submitted_materials ? JSON.parse(supplement.submitted_materials) : null
  };
}

async function getSupplementsByApplication(applicationId) {
  const supplements = await allQuery(
    'SELECT * FROM supplements WHERE application_id = ? ORDER BY create_time DESC',
    [applicationId]
  );
  
  return supplements.map(s => ({
    ...s,
    missing_materials: JSON.parse(s.missing_materials),
    submitted_materials: s.submitted_materials ? JSON.parse(s.submitted_materials) : null
  }));
}

async function submitSupplement(id, submittedMaterials, operator = 'system') {
  const supplement = await getSupplementById(id);
  
  if (supplement.status !== SUPPLEMENT_STATUSES.PENDING) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `材料补正任务当前状态为 ${supplement.status}，无法提交`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = supplement.version + 1;
  
  await runQuery(
    `UPDATE supplements SET submitted_materials = ?, supplement_time = ?, status = ?, update_time = ?, version = ?
     WHERE id = ? AND version = ?`,
    [JSON.stringify(submittedMaterials), currentTime, SUPPLEMENT_STATUSES.SUBMITTED, currentTime, newVersion, id, supplement.version]
  );
  
  await applicationService.updateApplicationStatus(
    supplement.application_id,
    APPLICATION_STATUSES.SUPPLEMENT_SUBMITTED,
    operator,
    '补正材料已提交'
  );
  
  await logService.createLog(
    supplement.application_id,
    OPERATION_TYPES.SUPPLEMENT_SUBMIT,
    operator,
    { status: supplement.status },
    { status: SUPPLEMENT_STATUSES.SUBMITTED },
    '补正材料已提交'
  );
  
  return await getSupplementById(id);
}

async function markSupplementOverdue(id, operator = 'system') {
  const supplement = await getSupplementById(id);
  
  if (supplement.status !== SUPPLEMENT_STATUSES.PENDING) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `材料补正任务当前状态为 ${supplement.status}，无法标记逾期`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = supplement.version + 1;
  
  await runQuery(
    `UPDATE supplements SET status = ?, update_time = ?, version = ?
     WHERE id = ? AND version = ?`,
    [SUPPLEMENT_STATUSES.OVERDUE, currentTime, newVersion, id, supplement.version]
  );
  
  await logService.createLog(
    supplement.application_id,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: supplement.status },
    { status: SUPPLEMENT_STATUSES.OVERDUE },
    '材料补正任务已逾期'
  );
  
  return await getSupplementById(id);
}

async function cancelSupplement(id, reason = null, operator = 'system') {
  const supplement = await getSupplementById(id);
  
  if (supplement.status !== SUPPLEMENT_STATUSES.PENDING) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `材料补正任务当前状态为 ${supplement.status}，无法取消`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = supplement.version + 1;
  
  await runQuery(
    `UPDATE supplements SET status = ?, update_time = ?, version = ?, remark = ?
     WHERE id = ? AND version = ?`,
    [SUPPLEMENT_STATUSES.CANCELLED, currentTime, newVersion, reason || supplement.remark, id, supplement.version]
  );
  
  await logService.createLog(
    supplement.application_id,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: supplement.status },
    { status: SUPPLEMENT_STATUSES.CANCELLED },
    reason || '材料补正任务已取消'
  );
  
  return await getSupplementById(id);
}

module.exports = {
  createSupplement,
  getSupplementById,
  getSupplementsByApplication,
  submitSupplement,
  markSupplementOverdue,
  cancelSupplement
};
