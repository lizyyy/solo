const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const {
  NotFoundError,
  StatusConflictError,
  ValidationError,
  ReportAlreadyExistsError,
  SourceRecordMissingError
} = require('../utils/errors');
const { REPORT_STATUS, SPECIMEN_STATUS, validateTransition } = require('../utils/statusMachine');
const statusHistoryService = require('./statusHistoryService');

async function generateReportNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `REPORT-${dateStr}-`;
  
  const maxNum = await get(
    `SELECT MAX(CAST(SUBSTR(report_number, ? + 1) AS INTEGER)) as max_num
     FROM reports
     WHERE report_number LIKE ?`,
    [prefix.length, `${prefix}%`]
  );

  const nextNum = (maxNum?.max_num || 0) + 1;
  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

async function createReport(data, operator = null) {
  const {
    specimen_id,
    report_type,
    result,
    conclusion
  } = data;

  if (!specimen_id) {
    throw new ValidationError('标本ID不能为空', 'specimen_id', specimen_id);
  }

  const specimen = await get('SELECT * FROM specimens WHERE id = ?', [specimen_id]);
  if (!specimen) {
    throw new SourceRecordMissingError('标本', specimen_id, '报告', 'new');
  }

  if (specimen.status !== SPECIMEN_STATUS.DELIVERED && 
      specimen.status !== SPECIMEN_STATUS.IN_TRANSIT) {
    throw new StatusConflictError(
      '标本',
      specimen_id,
      specimen.status,
      [SPECIMEN_STATUS.DELIVERED, SPECIMEN_STATUS.IN_TRANSIT],
      '创建报告'
    );
  }

  const existingReport = await get('SELECT id, report_number FROM reports WHERE specimen_id = ?', [specimen_id]);
  if (existingReport) {
    throw new ReportAlreadyExistsError(specimen_id, existingReport.id);
  }

  const reportNumber = await generateReportNumber();
  const id = uuidv4();
  const status = REPORT_STATUS.GENERATED;
  const generatedTime = new Date().toISOString();

  await run(
    `INSERT INTO reports 
     (id, specimen_id, batch_id, report_number, report_type, result, conclusion, reporter, generated_time, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, specimen_id, specimen.batch_id, reportNumber, report_type, result, conclusion, operator, generatedTime, status]
  );

  await statusHistoryService.recordStatusChange('report', id, null, status, operator, '报告已生成');

  await run(
    'UPDATE specimens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [SPECIMEN_STATUS.REPORTED, specimen_id]
  );

  await statusHistoryService.recordStatusChange(
    'specimen',
    specimen_id,
    specimen.status,
    SPECIMEN_STATUS.REPORTED,
    operator,
    `报告已生成: ${reportNumber}`
  );

  return getReportById(id);
}

async function getReportById(id) {
  const report = await get('SELECT * FROM reports WHERE id = ?', [id]);
  
  if (!report) {
    return null;
  }

  const specimen = await get(
    'SELECT id, barcode, patient_name, patient_id, specimen_type, batch_id FROM specimens WHERE id = ?',
    [report.specimen_id]
  );

  const batch = report.batch_id ? await get(
    'SELECT id, batch_number, destination_lab FROM batches WHERE id = ?',
    [report.batch_id]
  ) : null;

  return {
    ...report,
    specimen,
    batch
  };
}

async function getReportByNumber(reportNumber) {
  const report = await get('SELECT id FROM reports WHERE report_number = ?', [reportNumber]);
  
  if (!report) {
    throw new NotFoundError('报告编号', reportNumber);
  }

  return getReportById(report.id);
}

async function getReportsBySpecimen(specimenId) {
  const specimen = await get('SELECT id FROM specimens WHERE id = ?', [specimenId]);
  if (!specimen) {
    throw new NotFoundError('标本', specimenId);
  }

  return all('SELECT * FROM reports WHERE specimen_id = ? ORDER BY created_at DESC', [specimenId]);
}

async function getAllReports(filters = {}) {
  let sql = `SELECT r.*, s.barcode, s.patient_name, b.batch_number
             FROM reports r
             LEFT JOIN specimens s ON r.specimen_id = s.id
             LEFT JOIN batches b ON r.batch_id = b.id
             WHERE 1=1`;
  const params = [];

  if (filters.status) {
    sql += ' AND r.status = ?';
    params.push(filters.status);
  }
  if (filters.specimen_id) {
    sql += ' AND r.specimen_id = ?';
    params.push(filters.specimen_id);
  }
  if (filters.batch_id) {
    sql += ' AND r.batch_id = ?';
    params.push(filters.batch_id);
  }
  if (filters.report_number) {
    sql += ' AND r.report_number = ?';
    params.push(filters.report_number);
  }

  sql += ' ORDER BY r.created_at DESC';

  return all(sql, params);
}

async function updateReportStatus(reportId, newStatus, operator = null, reason = null) {
  const report = await getReportById(reportId);

  if (!report) {
    throw new NotFoundError('报告', reportId);
  }

  const currentStatus = report.status;

  if (currentStatus === newStatus) {
    return report;
  }

  validateTransition('report', currentStatus, newStatus);

  let updateFields = 'status = ?, updated_at = CURRENT_TIMESTAMP';
  const updateParams = [newStatus];

  if (newStatus === REPORT_STATUS.REVIEWED) {
    updateFields += ', reviewed_by = ?, reviewed_time = ?';
    updateParams.push(operator, new Date().toISOString());
  } else if (newStatus === REPORT_STATUS.FINALIZED) {
    updateFields += ', finalized_time = ?';
    updateParams.push(new Date().toISOString());
  }

  updateParams.push(reportId);

  await run(`UPDATE reports SET ${updateFields} WHERE id = ?`, updateParams);

  await statusHistoryService.recordStatusChange('report', reportId, currentStatus, newStatus, operator, reason);

  if (newStatus === REPORT_STATUS.FINALIZED && report.specimen) {
    const specimen = await get('SELECT status FROM specimens WHERE id = ?', [report.specimen.id]);
    if (specimen && specimen.status === SPECIMEN_STATUS.REPORTED) {
      await run(
        'UPDATE specimens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [SPECIMEN_STATUS.COMPLETED, report.specimen.id]
      );

      await statusHistoryService.recordStatusChange(
        'specimen',
        report.specimen.id,
        SPECIMEN_STATUS.REPORTED,
        SPECIMEN_STATUS.COMPLETED,
        operator,
        `报告已终审: ${report.report_number}`
      );
    }
  }

  return getReportById(reportId);
}

async function reviewReport(reportId, reviewedBy, reason = null) {
  return updateReportStatus(reportId, REPORT_STATUS.REVIEWED, reviewedBy, reason || '报告已审核');
}

async function finalizeReport(reportId, operator = null) {
  return updateReportStatus(reportId, REPORT_STATUS.FINALIZED, operator, '报告已终审');
}

async function updateReportContent(reportId, data, operator = null) {
  const report = await getReportById(reportId);
  
  if (!report) {
    throw new NotFoundError('报告', reportId);
  }

  if (report.status !== REPORT_STATUS.GENERATED) {
    throw new StatusConflictError(
      '报告',
      reportId,
      report.status,
      [REPORT_STATUS.GENERATED],
      '修改报告内容'
    );
  }

  const { result, conclusion, report_type } = data;

  await run(
    `UPDATE reports 
     SET result = COALESCE(?, result),
         conclusion = COALESCE(?, conclusion),
         report_type = COALESCE(?, report_type)
     WHERE id = ?`,
    [result, conclusion, report_type, reportId]
  );

  return getReportById(reportId);
}

module.exports = {
  createReport,
  getReportById,
  getReportByNumber,
  getReportsBySpecimen,
  getAllReports,
  updateReportStatus,
  reviewReport,
  finalizeReport,
  updateReportContent
};
