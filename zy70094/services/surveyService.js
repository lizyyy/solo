const { runQuery, getQuery, allQuery } = require('../database');
const { generateId, getCurrentTime, createError, validateRequiredFields } = require('../utils/helpers');
const { SURVEY_STATUSES, APPLICATION_STATUSES, OPERATION_TYPES, ERROR_CODES } = require('../utils/constants');
const applicationService = require('./applicationService');
const logService = require('./logService');

async function createSurvey(applicationId, data, operator = 'system') {
  await applicationService.getApplicationById(applicationId);
  
  const existingSurvey = await getQuery(
    'SELECT * FROM surveys WHERE application_id = ? AND status NOT IN ("COMPLETED", "CANCELLED")',
    [applicationId]
  );
  
  if (existingSurvey) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `该申请单已存在进行中的勘察任务 (ID: ${existingSurvey.id})`
    );
  }
  
  const id = generateId();
  const currentTime = getCurrentTime();
  
  await runQuery(
    `INSERT INTO surveys (id, application_id, scheduled_time, surveyor, status, create_time, update_time, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      applicationId,
      data.scheduled_time || null,
      data.surveyor || null,
      data.scheduled_time ? SURVEY_STATUSES.SCHEDULED : SURVEY_STATUSES.PENDING,
      currentTime,
      currentTime,
      data.remark || null
    ]
  );
  
  await applicationService.updateApplicationStatus(
    applicationId,
    APPLICATION_STATUSES.PENDING_SURVEY,
    operator,
    '已创建勘察预约任务'
  );
  
  const newSurvey = await getQuery('SELECT * FROM surveys WHERE id = ?', [id]);
  
  await logService.createLog(
    applicationId,
    OPERATION_TYPES.SURVEY_SCHEDULE,
    operator,
    null,
    { surveyId: id, scheduledTime: data.scheduled_time },
    '勘察预约已创建'
  );
  
  return newSurvey;
}

async function getSurveyById(id) {
  const survey = await getQuery('SELECT * FROM surveys WHERE id = ?', [id]);
  
  if (!survey) {
    throw createError(ERROR_CODES.NOT_FOUND, '勘察任务不存在');
  }
  
  return survey;
}

async function getSurveysByApplication(applicationId) {
  return await allQuery(
    'SELECT * FROM surveys WHERE application_id = ? ORDER BY create_time DESC',
    [applicationId]
  );
}

async function scheduleSurvey(id, scheduledTime, surveyor = null, operator = 'system') {
  const survey = await getSurveyById(id);
  
  if (survey.status !== SURVEY_STATUSES.PENDING) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `勘察任务当前状态为 ${survey.status}，无法再次预约`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = survey.version + 1;
  
  await runQuery(
    `UPDATE surveys SET scheduled_time = ?, surveyor = ?, status = ?, update_time = ?, version = ?
     WHERE id = ? AND version = ?`,
    [scheduledTime, surveyor, SURVEY_STATUSES.SCHEDULED, currentTime, newVersion, id, survey.version]
  );
  
  await logService.createLog(
    survey.application_id,
    OPERATION_TYPES.SURVEY_SCHEDULE,
    operator,
    { status: survey.status },
    { status: SURVEY_STATUSES.SCHEDULED, scheduledTime },
    '勘察时间已预约'
  );
  
  return await getSurveyById(id);
}

async function completeSurvey(id, surveyResult, operator = 'system') {
  const survey = await getSurveyById(id);
  
  if (survey.status !== SURVEY_STATUSES.SCHEDULED) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `勘察任务当前状态为 ${survey.status}，无法完成`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = survey.version + 1;
  
  await runQuery(
    `UPDATE surveys SET survey_result = ?, survey_time = ?, status = ?, update_time = ?, version = ?
     WHERE id = ? AND version = ?`,
    [JSON.stringify(surveyResult), currentTime, SURVEY_STATUSES.COMPLETED, currentTime, newVersion, id, survey.version]
  );
  
  await applicationService.updateApplicationStatus(
    survey.application_id,
    APPLICATION_STATUSES.SURVEY_COMPLETED,
    operator,
    '现场勘察已完成'
  );
  
  await logService.createLog(
    survey.application_id,
    OPERATION_TYPES.SURVEY_COMPLETE,
    operator,
    { status: survey.status },
    { status: SURVEY_STATUSES.COMPLETED },
    '现场勘察已完成，勘察结果已记录'
  );
  
  return await getSurveyById(id);
}

async function cancelSurvey(id, reason = null, operator = 'system') {
  const survey = await getSurveyById(id);
  
  if ([SURVEY_STATUSES.COMPLETED, SURVEY_STATUSES.CANCELLED].includes(survey.status)) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `勘察任务当前状态为 ${survey.status}，无法取消`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = survey.version + 1;
  
  await runQuery(
    `UPDATE surveys SET status = ?, update_time = ?, version = ?, remark = ?
     WHERE id = ? AND version = ?`,
    [SURVEY_STATUSES.CANCELLED, currentTime, newVersion, reason || survey.remark, id, survey.version]
  );
  
  await logService.createLog(
    survey.application_id,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: survey.status },
    { status: SURVEY_STATUSES.CANCELLED },
    reason || '勘察任务已取消'
  );
  
  return await getSurveyById(id);
}

async function failSurvey(id, reason = null, operator = 'system') {
  const survey = await getSurveyById(id);
  
  if ([SURVEY_STATUSES.COMPLETED, SURVEY_STATUSES.CANCELLED, SURVEY_STATUSES.FAILED].includes(survey.status)) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `勘察任务当前状态为 ${survey.status}，无法标记失败`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = survey.version + 1;
  
  await runQuery(
    `UPDATE surveys SET status = ?, update_time = ?, version = ?, remark = ?
     WHERE id = ? AND version = ?`,
    [SURVEY_STATUSES.FAILED, currentTime, newVersion, reason || survey.remark, id, survey.version]
  );
  
  await logService.createLog(
    survey.application_id,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: survey.status },
    { status: SURVEY_STATUSES.FAILED },
    reason || '勘察任务执行失败'
  );
  
  return await getSurveyById(id);
}

module.exports = {
  createSurvey,
  getSurveyById,
  getSurveysByApplication,
  scheduleSurvey,
  completeSurvey,
  cancelSurvey,
  failSurvey
};
