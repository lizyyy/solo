const { getDb } = require('../db');
const { RecordModel, AuditLogModel, ExceptionModel, RectificationModel } = require('../models');

const db = getDb();

const VALID_ACTIONS = ['processed', 'returned', 'missing_photos', 'rework_verification', 'overdue_deduction'];

function markProcessed(recordId, handler, remark) {
  const record = RecordModel.findById(recordId);
  if (!record) {
    throw new Error(`记录不存在: ${recordId}`);
  }

  const tx = db.transaction(() => {
    RecordModel.updateStatus(recordId, 'processed', remark || '已处理放行');
    AuditLogModel.create(recordId, 'processed', remark || '已处理放行', handler, {
      previous_status: record.status
    });
  });

  tx();
  return { success: true, recordId, status: 'processed' };
}

function returnForModification(recordId, handler, reason) {
  const record = RecordModel.findById(recordId);
  if (!record) {
    throw new Error(`记录不存在: ${recordId}`);
  }

  const tx = db.transaction(() => {
    RecordModel.updateStatus(recordId, 'returned', reason || '退回修改');
    AuditLogModel.create(recordId, 'returned', reason || '退回修改', handler, {
      previous_status: record.status
    });
  });

  tx();
  return { success: true, recordId, status: 'returned' };
}

function logException(recordId, type, handler, reason) {
  const validTypes = ['missing_photos', 'rework_verification', 'overdue_deduction'];
  if (!validTypes.includes(type)) {
    throw new Error(`无效的异常类型: ${type}，有效类型: ${validTypes.join(', ')}`);
  }

  const record = RecordModel.findById(recordId);
  if (!record) {
    throw new Error(`记录不存在: ${recordId}`);
  }

  const tx = db.transaction(() => {
    ExceptionModel.create(recordId, type, reason || '', handler);
    RecordModel.updateStatus(recordId, 'exception', `异常: ${type} - ${reason || ''}`);
    AuditLogModel.create(recordId, 'exception_logged', reason || '', handler, {
      exception_type: type,
      previous_status: record.status
    });
  });

  tx();
  return { success: true, recordId, exceptionType: type };
}

function addRectification(recordId, handler, rectificationNo, rectFormData) {
  const record = RecordModel.findById(recordId);
  if (!record) {
    throw new Error(`记录不存在: ${recordId}`);
  }

  const tx = db.transaction(() => {
    RecordModel.incrementRectificationCount(recordId);
    const updatedRecord = RecordModel.findById(recordId);
    const newCount = updatedRecord.rectification_count;

    let sourceRecordId = null;
    const previousRects = RectificationModel.findByRecord(recordId);
    if (previousRects.length > 0) {
      const lastRect = previousRects[previousRects.length - 1];
      sourceRecordId = recordId;
    }

    RectificationModel.create(
      recordId,
      rectificationNo,
      newCount,
      rectFormData,
      sourceRecordId,
      handler
    );

    RecordModel.updateStatus(recordId, 'returned', `第${newCount}次整改`);

    AuditLogModel.create(recordId, 'rectification_added', `第${newCount}次整改`, handler, {
      rectification_count: newCount,
      rectification_no: rectificationNo,
      source_record_id: sourceRecordId,
      previous_status: record.status
    });
  });

  tx();
  return { success: true, recordId, rectificationCount: RecordModel.findById(recordId).rectification_count };
}

function getRecordDetail(recordId) {
  const record = RecordModel.findById(recordId);
  if (!record) return null;

  const auditLogs = AuditLogModel.findByRecord(recordId);
  const exceptions = ExceptionModel.findByRecord(recordId);
  const rectifications = RectificationModel.findByRecord(recordId);
  const traceChain = RectificationModel.getTraceChain(recordId);

  return {
    ...record,
    raw_data: record.raw_data ? JSON.parse(record.raw_data) : null,
    photo_list: record.photo_list ? JSON.parse(record.photo_list) : null,
    rectification_form: record.rectification_form ? JSON.parse(record.rectification_form) : null,
    audit_logs: auditLogs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    })),
    exceptions,
    rectifications: rectifications.map(r => ({
      ...r,
      rectification_form_data: r.rectification_form_data ? JSON.parse(r.rectification_form_data) : null
    })),
    trace_chain: traceChain.map(r => ({
      ...r,
      rectification_form_data: r.rectification_form_data ? JSON.parse(r.rectification_form_data) : null
    }))
  };
}

module.exports = {
  markProcessed,
  returnForModification,
  logException,
  addRectification,
  getRecordDetail,
  VALID_ACTIONS
};