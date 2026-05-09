const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const { COMPLAINT_STATUS, REPORT_STATUS, isValidStatusTransition, now } = require('../utils/status');
const { checkIdempotency, logOperation } = require('../utils/idempotency');
const { getActivityById } = require('./activityService');
const { getSampleById, retainSampleForInvestigation } = require('./batchService');

const createComplaint = async (data, requestId = null, operator = 'system') => {
  const {
    activityId,
    sampleArchiveId,
    complaintType,
    complaintDate,
    complaintContent,
    complainant,
    contactInfo
  } = data;

  if (activityId) {
    const activity = await getActivityById(activityId);
    if (!activity) {
      return { success: false, error: '关联的活动不存在', code: 'NOT_FOUND' };
    }
  }

  if (sampleArchiveId) {
    const sample = await getSampleById(sampleArchiveId);
    if (!sample) {
      return { success: false, error: '关联的留样不存在', code: 'NOT_FOUND' };
    }
  }

  const idempotencyCheck = await checkIdempotency('complaint', 'CREATE', requestId);
  if (idempotencyCheck.isDuplicate) {
    const existing = await getComplaintById(JSON.parse(idempotencyCheck.existingLog.details).id);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复请求',
      data: existing
    };
  }

  const id = uuidv4();
  const sql = `INSERT INTO complaints 
               (id, activity_id, sample_archive_id, complaint_type, complaint_date, complaint_content, complainant, contact_info, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  await run(sql, [
    id,
    activityId || null,
    sampleArchiveId || null,
    complaintType,
    complaintDate,
    complaintContent,
    complainant,
    contactInfo || null,
    COMPLAINT_STATUS.PENDING,
    now(),
    now()
  ]);

  await logOperation('complaint', id, 'CREATE', requestId, operator, null, COMPLAINT_STATUS.PENDING, { ...data });

  if (sampleArchiveId) {
    await retainSampleForInvestigation(sampleArchiveId, null, operator, `关联投诉: ${id}`);
  }

  const complaint = await getComplaintById(id);
  return {
    success: true,
    isDuplicate: false,
    data: complaint
  };
};

const getComplaintById = async (id) => {
  const sql = `SELECT c.*, a.activity_name, a.store_name, b.batch_number
               FROM complaints c
               LEFT JOIN activities a ON c.activity_id = a.id
               LEFT JOIN sample_archives sa ON c.sample_archive_id = sa.id
               LEFT JOIN batches b ON sa.batch_id = b.id
               WHERE c.id = ?`;
  return await get(sql, [id]);
};

const getComplaints = async (filters = {}) => {
  let sql = `SELECT c.*, a.activity_name, a.store_name FROM complaints c
              LEFT JOIN activities a ON c.activity_id = a.id
              WHERE 1=1`;
  const params = [];

  if (filters.activityId) {
    sql += ' AND c.activity_id = ?';
    params.push(filters.activityId);
  }
  if (filters.status) {
    sql += ' AND c.status = ?';
    params.push(filters.status);
  }
  if (filters.complaintDateFrom) {
    sql += ' AND c.complaint_date >= ?';
    params.push(filters.complaintDateFrom);
  }

  sql += ' ORDER BY c.created_at DESC';

  return await all(sql, params);
};

const advanceComplaintStatus = async (id, targetStatus, requestId = null, operator = 'system', resolution = null) => {
  const complaint = await getComplaintById(id);
  if (!complaint) {
    return { success: false, error: '投诉记录不存在', code: 'NOT_FOUND' };
  }

  if (!Object.values(COMPLAINT_STATUS).includes(targetStatus)) {
    return { success: false, error: '无效的目标状态', code: 'INVALID_STATUS' };
  }

  if (!isValidStatusTransition('complaints', complaint.status, targetStatus)) {
    return {
      success: false,
      error: `状态流转不允许: ${complaint.status} -> ${targetStatus}`,
      code: 'INVALID_TRANSITION'
    };
  }

  const idempotencyCheck = await checkIdempotency('complaint', 'ADVANCE_STATUS', requestId, id);
  if (idempotencyCheck.isDuplicate) {
    const updated = await getComplaintById(id);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复推进请求',
      data: updated
    };
  }

  let sql;
  let params;

  if (targetStatus === COMPLAINT_STATUS.RESOLVED || targetStatus === COMPLAINT_STATUS.CLOSED) {
    sql = `UPDATE complaints SET status = ?, resolution = ?, resolved_at = ?, updated_at = ? WHERE id = ?`;
    params = [targetStatus, resolution || null, now(), now(), id];
  } else {
    sql = `UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?`;
    params = [targetStatus, now(), id];
  }

  await run(sql, params);
  await logOperation('complaint', id, 'ADVANCE_STATUS', requestId, operator, complaint.status, targetStatus, { resolution });

  const updated = await getComplaintById(id);
  return {
    success: true,
    isDuplicate: false,
    data: updated
  };
};

const updateComplaint = async (id, data, requestId = null, operator = 'system') => {
  const complaint = await getComplaintById(id);
  if (!complaint) {
    return { success: false, error: '投诉记录不存在', code: 'NOT_FOUND' };
  }

  if (complaint.status === COMPLAINT_STATUS.CLOSED) {
    return { success: false, error: '已关闭的投诉无法修改', code: 'READONLY_STATUS' };
  }

  const fieldMapping = {
    complaintType: 'complaint_type',
    complaintContent: 'complaint_content',
    contactInfo: 'contact_info'
  };

  const updates = [];
  const params = [];

  for (const [key, dbField] of Object.entries(fieldMapping)) {
    if (data[key] !== undefined) {
      updates.push(`${dbField} = ?`);
      params.push(data[key]);
    }
  }

  if (updates.length === 0) {
    return { success: true, data: complaint, message: '无需要更新的字段' };
  }

  const idempotencyCheck = await checkIdempotency('complaint', 'UPDATE', requestId, id);
  if (idempotencyCheck.isDuplicate) {
    const updated = await getComplaintById(id);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复修改请求',
      data: updated
    };
  }

  updates.push('updated_at = ?');
  params.push(now());
  params.push(id);

  const sql = `UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`;
  await run(sql, params);
  await logOperation('complaint', id, 'UPDATE', requestId, operator, null, null, data);

  const updated = await getComplaintById(id);
  return {
    success: true,
    isDuplicate: false,
    data: updated
  };
};

const createTraceReport = async (complaintId, data, requestId = null, operator = 'system') => {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return { success: false, error: '投诉记录不存在', code: 'NOT_FOUND' };
  }

  const { reportContent, reportDate, activityId } = data;

  const idempotencyCheck = await checkIdempotency('trace_report', 'CREATE', requestId, complaintId);
  if (idempotencyCheck.isDuplicate) {
    const existing = await getReportsByComplaint(complaintId);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复请求',
      data: existing
    };
  }

  const id = uuidv4();
  const sql = `INSERT INTO trace_reports 
               (id, complaint_id, activity_id, report_content, report_date, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

  await run(sql, [
    id,
    complaintId,
    activityId || complaint.activity_id || null,
    reportContent,
    reportDate,
    REPORT_STATUS.PENDING,
    now()
  ]);

  await logOperation('trace_report', id, 'CREATE', requestId, operator, null, REPORT_STATUS.PENDING, { complaintId, ...data });

  const report = await getReportById(id);
  return {
    success: true,
    isDuplicate: false,
    data: report
  };
};

const getReportById = async (id) => {
  const sql = `SELECT tr.*, c.complaint_content, a.activity_name, a.store_name
               FROM trace_reports tr
               LEFT JOIN complaints c ON tr.complaint_id = c.id
               LEFT JOIN activities a ON tr.activity_id = a.id
               WHERE tr.id = ?`;
  return await get(sql, [id]);
};

const getReportsByComplaint = async (complaintId) => {
  const sql = `SELECT * FROM trace_reports WHERE complaint_id = ? ORDER BY created_at DESC`;
  return await all(sql, [complaintId]);
};

const completeReport = async (id, conclusion, requestId = null, operator = 'system') => {
  const report = await getReportById(id);
  if (!report) {
    return { success: false, error: '追溯报告不存在', code: 'NOT_FOUND' };
  }

  if (report.status === REPORT_STATUS.COMPLETED) {
    return { success: false, error: '报告已完成', code: 'ALREADY_COMPLETED' };
  }

  const idempotencyCheck = await checkIdempotency('trace_report', 'COMPLETE', requestId, id);
  if (idempotencyCheck.isDuplicate) {
    const updated = await getReportById(id);
    return {
      success: true,
      isDuplicate: true,
      message: '检测到重复完成请求',
      data: updated
    };
  }

  const sql = `UPDATE trace_reports SET conclusion = ?, status = ? WHERE id = ?`;
  await run(sql, [conclusion, REPORT_STATUS.COMPLETED, id]);
  await logOperation('trace_report', id, 'COMPLETE', requestId, operator, report.status, REPORT_STATUS.COMPLETED, { conclusion });

  const updated = await getReportById(id);
  return {
    success: true,
    isDuplicate: false,
    data: updated
  };
};

const getFullTraceInfo = async (complaintId) => {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return { success: false, error: '投诉记录不存在', code: 'NOT_FOUND' };
  }

  const reports = await getReportsByComplaint(complaintId);
  
  let activity = null;
  let samples = [];
  let batches = [];

  if (complaint.activity_id) {
    activity = await getActivityById(complaint.activity_id);
    if (activity) {
      samples = await all(`SELECT * FROM sample_archives WHERE activity_id = ?`, [complaint.activity_id]);
      batches = await all(`SELECT * FROM batches WHERE activity_id = ?`, [complaint.activity_id]);
    }
  }

  if (complaint.sample_archive_id) {
    const sample = await getSampleById(complaint.sample_archive_id);
    if (sample) {
      return {
        success: true,
        data: {
          complaint,
          reportCount: reports.length,
          reports,
          activity,
          relatedSample: sample,
          batches,
          allSamples: samples
        }
      };
    }
  }

  return {
    success: true,
    data: {
      complaint,
      reportCount: reports.length,
      reports,
      activity,
      batches,
      allSamples: samples
    }
  };
};

module.exports = {
  createComplaint,
  getComplaintById,
  getComplaints,
  advanceComplaintStatus,
  updateComplaint,
  createTraceReport,
  getReportById,
  getReportsByComplaint,
  completeReport,
  getFullTraceInfo,
  COMPLAINT_STATUS,
  REPORT_STATUS
};
