const { runQuery, getQuery, allQuery } = require('../database');
const { generateId, getCurrentTime, createError } = require('../utils/helpers');
const { REPORT_STATUSES, APPLICATION_STATUSES, OPERATION_TYPES, ERROR_CODES } = require('../utils/constants');
const applicationService = require('./applicationService');
const logService = require('./logService');

async function createGridReport(applicationId, data = {}, operator = 'system') {
  const application = await applicationService.getApplicationById(applicationId);
  
  if (application.status !== APPLICATION_STATUSES.METER_INSTALLED) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `申请单状态为 ${application.status}，只有电表安装完成后才能创建并网报表`
    );
  }
  
  const existingReport = await getQuery(
    'SELECT * FROM grid_reports WHERE application_id = ?',
    [applicationId]
  );
  
  if (existingReport) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `该申请单已存在并网报表 (ID: ${existingReport.id})`
    );
  }
  
  const id = generateId();
  const currentTime = getCurrentTime();
  
  const reportContent = data.report_content || `光伏并网报表
申请人: ${application.applicant_name}
联系电话: ${application.contact_phone}
地址: ${application.address}
光伏容量: ${application.pv_capacity} kW
生成时间: ${currentTime}`;
  
  await runQuery(
    `INSERT INTO grid_reports (id, application_id, report_content, grid_connection_time, operator, status, create_time, update_time, remark, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      applicationId,
      reportContent,
      null,
      operator,
      REPORT_STATUSES.GENERATED,
      currentTime,
      currentTime,
      data.remark || null,
      1
    ]
  );
  
  const newReport = await getQuery('SELECT * FROM grid_reports WHERE id = ?', [id]);
  
  await logService.createLog(
    applicationId,
    OPERATION_TYPES.REPORT_GENERATE,
    operator,
    null,
    { reportId: id },
    '并网报表已生成'
  );
  
  return newReport;
}

async function getReportById(id) {
  const report = await getQuery('SELECT * FROM grid_reports WHERE id = ?', [id]);
  
  if (!report) {
    throw createError(ERROR_CODES.NOT_FOUND, '并网报表不存在');
  }
  
  return report;
}

async function getReportsByApplication(applicationId) {
  return await allQuery(
    'SELECT * FROM grid_reports WHERE application_id = ? ORDER BY create_time DESC',
    [applicationId]
  );
}

async function approveGridReport(id, operator = 'system') {
  const report = await getReportById(id);
  
  if (report.status !== REPORT_STATUSES.GENERATED) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `并网报表当前状态为 ${report.status}，无法审批`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = report.version + 1;
  
  await runQuery(
    `UPDATE grid_reports SET grid_connection_time = ?, status = ?, update_time = ?, version = ?
     WHERE id = ? AND version = ?`,
    [currentTime, REPORT_STATUSES.APPROVED, currentTime, newVersion, id, report.version]
  );
  
  await applicationService.updateApplicationStatus(
    report.application_id,
    APPLICATION_STATUSES.GRID_CONNECTED,
    operator,
    '并网完成'
  );
  
  await logService.createLog(
    report.application_id,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: report.status },
    { status: REPORT_STATUSES.APPROVED, gridConnectionTime: currentTime },
    '并网报表已审批通过，并网完成'
  );
  
  return await getReportById(id);
}

module.exports = {
  createGridReport,
  getReportById,
  getReportsByApplication,
  approveGridReport
};
