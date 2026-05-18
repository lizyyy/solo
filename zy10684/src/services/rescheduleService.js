const { v4: uuidv4 } = require('uuid');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const data = require('../models/data');

const RESCHEDULE_STATUSES = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  NOTIFIED: 'NOTIFIED',
  REFUNDED: 'REFUNDED',
  RESCHEDULED: 'RESCHEDULED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
};

const RESCHEDULE_REASONS = {
  DOCTOR_ABSENT: '医生停诊',
  DOCTOR_MEETING: '医生参会',
  DEPARTMENT_ADJUST: '科室调整',
  SYSTEM_MAINTENANCE: '系统维护',
};

function getDoctorById(id) {
  return data.doctors.find(d => d.id === id);
}

function getScheduleById(id) {
  return data.schedules.find(s => s.id === id);
}

function getPatientById(id) {
  return data.patients.find(p => p.id === id);
}

function getAppointmentById(id) {
  return data.appointments.find(a => a.id === id);
}

function addHistory(batchId, recordId, operation, operator, remark = '') {
  data.operationHistory.push({
    id: uuidv4(),
    batchId,
    recordId,
    operation,
    operator,
    remark,
    operatedAt: new Date().toISOString(),
  });
}

function createRescheduleBatch(batchData) {
  const { doctorId, scheduleId, reason, operator, targetScheduleId } = batchData;

  const doctor = getDoctorById(doctorId);
  const schedule = getScheduleById(scheduleId);

  if (!doctor || !schedule) {
    throw new Error('医生或号源不存在');
  }

  const affectedAppointments = data.appointments.filter(
    a => a.scheduleId === scheduleId && a.status === 'CONFIRMED'
  );

  if (affectedAppointments.length === 0) {
    throw new Error('该号源下无已预约患者');
  }

  const batchId = uuidv4();
  const batch = {
    id: batchId,
    batchNo: `RS${Date.now()}`,
    doctorId,
    doctorName: doctor.name,
    scheduleId,
    scheduleDate: schedule.date,
    scheduleTimeSlot: schedule.timeSlot,
    reason: reason || RESCHEDULE_REASONS.DOCTOR_ABSENT,
    targetScheduleId,
    totalCount: affectedAppointments.length,
    successCount: 0,
    failedCount: 0,
    status: 'CREATED',
    operator,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.rescheduleBatches.push(batch);
  addHistory(batchId, null, '创建改约批次', operator, `涉及${affectedAppointments.length}名患者`);

  affectedAppointments.forEach((apt, index) => {
    const patient = getPatientById(apt.patientId);
    const recordId = uuidv4();
    const record = {
      id: recordId,
      batchId,
      appointmentId: apt.id,
      patientId: apt.patientId,
      patientName: patient?.name || '未知',
      patientPhone: patient?.phone || '',
      originalScheduleId: scheduleId,
      targetScheduleId: targetScheduleId || null,
      status: RESCHEDULE_STATUSES.PENDING,
      reason: batch.reason,
      notifiedAt: null,
      refundedAt: null,
      rescheduledAt: null,
      retryCount: 0,
      errorMsg: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    data.rescheduleRecords.push(record);
  });

  return { batch, recordsCount: affectedAppointments.length };
}

function submitBatch(batchId, operator) {
  const batch = data.rescheduleBatches.find(b => b.id === batchId);
  if (!batch) throw new Error('批次不存在');
  if (batch.status === 'PROCESSING') throw new Error('批次正在处理中');
  if (batch.status === 'CANCELLED') throw new Error('批次已撤回，需重新创建');

  batch.status = 'PROCESSING';
  batch.updatedAt = new Date().toISOString();
  addHistory(batchId, null, '提交改约批次', operator);

  const records = data.rescheduleRecords.filter(r => r.batchId === batchId);
  
  records.forEach(record => {
    if (record.status === RESCHEDULE_STATUSES.PENDING || record.status === RESCHEDULE_STATUSES.CANCELLED) {
      record.status = RESCHEDULE_STATUSES.PROCESSING;
      record.updatedAt = new Date().toISOString();
    }
  });

  return batch;
}

function cancelBatch(batchId, operator) {
  const batch = data.rescheduleBatches.find(b => b.id === batchId);
  if (!batch) throw new Error('批次不存在');
  if (batch.status !== 'CREATED') throw new Error('只能撤回待提交的批次');

  batch.status = 'CANCELLED';
  batch.updatedAt = new Date().toISOString();
  addHistory(batchId, null, '撤回改约批次', operator);

  const records = data.rescheduleRecords.filter(r => r.batchId === batchId);
  records.forEach(record => {
    record.status = RESCHEDULE_STATUSES.CANCELLED;
    record.updatedAt = new Date().toISOString();
  });

  return batch;
}

function processNotifications(batchId, operator) {
  const batch = data.rescheduleBatches.find(b => b.id === batchId);
  if (!batch) throw new Error('批次不存在');

  const records = data.rescheduleRecords.filter(
    r => r.batchId === batchId && r.status === RESCHEDULE_STATUSES.PROCESSING
  );

  records.forEach(record => {
    record.status = RESCHEDULE_STATUSES.NOTIFIED;
    record.notifiedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    addHistory(batchId, record.id, '发送通知', operator, `通知患者: ${record.patientName}`);
  });

  batch.updatedAt = new Date().toISOString();
  return { processed: records.length };
}

function processRefund(batchId, recordIds, operator) {
  const batch = data.rescheduleBatches.find(b => b.id === batchId);
  if (!batch) throw new Error('批次不存在');

  const records = data.rescheduleRecords.filter(
    r => r.batchId === batchId && recordIds.includes(r.id) && 
    (r.status === RESCHEDULE_STATUSES.NOTIFIED)
  );

  records.forEach(record => {
    record.status = RESCHEDULE_STATUSES.REFUNDED;
    record.refundedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    addHistory(batchId, record.id, '办理退款', operator, `退款患者: ${record.patientName}`);
    batch.successCount++;
  });

  batch.updatedAt = new Date().toISOString();
  return { refunded: records.length };
}

function processReschedule(batchId, recordIds, targetScheduleId, operator) {
  const batch = data.rescheduleBatches.find(b => b.id === batchId);
  if (!batch) throw new Error('批次不存在');

  const targetSchedule = getScheduleById(targetScheduleId);
  if (!targetSchedule) throw new Error('目标号源不存在');

  const records = data.rescheduleRecords.filter(
    r => r.batchId === batchId && recordIds.includes(r.id)
  );

  records.forEach(record => {
    if (record.status === RESCHEDULE_STATUSES.REFUNDED) {
      addHistory(batchId, record.id, '自动改约', operator, `患者${record.patientName}退款后被重新改约`);
    }
    
    record.status = RESCHEDULE_STATUSES.RESCHEDULED;
    record.targetScheduleId = targetScheduleId;
    record.rescheduledAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    addHistory(batchId, record.id, '完成改约', operator, `改约患者: ${record.patientName} 至 ${targetSchedule.date} ${targetSchedule.timeSlot}`);
    batch.successCount++;
  });

  batch.updatedAt = new Date().toISOString();
  return { rescheduled: records.length };
}

function markAsFailed(batchId, recordIds, errorMsg, operator) {
  const batch = data.rescheduleBatches.find(b => b.id === batchId);
  if (!batch) throw new Error('批次不存在');

  const records = data.rescheduleRecords.filter(
    r => r.batchId === batchId && recordIds.includes(r.id)
  );

  records.forEach(record => {
    record.status = RESCHEDULE_STATUSES.FAILED;
    record.errorMsg = errorMsg;
    record.updatedAt = new Date().toISOString();
    addHistory(batchId, record.id, '处理失败', operator, errorMsg);
    batch.failedCount++;
  });

  batch.updatedAt = new Date().toISOString();
  return { failed: records.length };
}

function getBatchList(query = {}) {
  let batches = [...data.rescheduleBatches];
  
  if (query.status) {
    batches = batches.filter(b => b.status === query.status);
  }
  if (query.doctorId) {
    batches = batches.filter(b => b.doctorId === query.doctorId);
  }
  
  return batches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getBatchDetail(batchId) {
  const batch = data.rescheduleBatches.find(b => b.id === batchId);
  if (!batch) throw new Error('批次不存在');

  const records = data.rescheduleRecords.filter(r => r.batchId === batchId);
  const history = data.operationHistory.filter(h => h.batchId === batchId);

  return {
    batch,
    records,
    history,
  };
}

function getRecordsByBatch(batchId, filters = {}) {
  let records = data.rescheduleRecords.filter(r => r.batchId === batchId);
  
  if (filters.status) {
    records = records.filter(r => r.status === filters.status);
  }
  
  return records;
}

function getOperationHistory(batchId = null) {
  let history = [...data.operationHistory];
  if (batchId) {
    history = history.filter(h => h.batchId === batchId);
  }
  return history.sort((a, b) => new Date(b.operatedAt) - new Date(a.operatedAt));
}

async function exportBatchToCsv(batchId, filePath) {
  const detail = getBatchDetail(batchId);
  const { batch, records } = detail;

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'batchNo', title: '改约批次号' },
      { id: 'doctorName', title: '医生姓名' },
      { id: 'originalDate', title: '原就诊日期' },
      { id: 'originalTimeSlot', title: '原就诊时段' },
      { id: 'reason', title: '改约原因' },
      { id: 'patientName', title: '患者姓名' },
      { id: 'patientPhone', title: '患者电话' },
      { id: 'status', title: '处理状态' },
      { id: 'statusText', title: '状态说明' },
      { id: 'notifiedAt', title: '通知时间' },
      { id: 'refundedAt', title: '退款时间' },
      { id: 'rescheduledAt', title: '改约完成时间' },
      { id: 'targetDate', title: '新就诊日期' },
      { id: 'targetTimeSlot', title: '新就诊时段' },
      { id: 'errorMsg', title: '错误信息' },
      { id: 'createdAt', title: '记录创建时间' },
    ],
  });

  const statusTextMap = {
    PENDING: '待处理',
    PROCESSING: '处理中',
    NOTIFIED: '已通知',
    REFUNDED: '已退款',
    RESCHEDULED: '已改约',
    CANCELLED: '已取消',
    FAILED: '处理失败',
  };

  const recordsData = records.map(record => {
    const targetSchedule = record.targetScheduleId ? getScheduleById(record.targetScheduleId) : null;
    return {
      batchNo: batch.batchNo,
      doctorName: batch.doctorName,
      originalDate: batch.scheduleDate,
      originalTimeSlot: batch.scheduleTimeSlot,
      reason: record.reason,
      patientName: record.patientName,
      patientPhone: record.patientPhone,
      status: record.status,
      statusText: statusTextMap[record.status] || record.status,
      notifiedAt: record.notifiedAt || '',
      refundedAt: record.refundedAt || '',
      rescheduledAt: record.rescheduledAt || '',
      targetDate: targetSchedule?.date || '',
      targetTimeSlot: targetSchedule?.timeSlot || '',
      errorMsg: record.errorMsg || '',
      createdAt: record.createdAt,
    };
  });

  await csvWriter.writeRecords(recordsData);
  return { filePath, recordCount: recordsData.length };
}

module.exports = {
  RESCHEDULE_STATUSES,
  RESCHEDULE_REASONS,
  createRescheduleBatch,
  submitBatch,
  cancelBatch,
  processNotifications,
  processRefund,
  processReschedule,
  markAsFailed,
  getBatchList,
  getBatchDetail,
  getRecordsByBatch,
  getOperationHistory,
  exportBatchToCsv,
  getDoctorById,
  getScheduleById,
  getPatientById,
};
