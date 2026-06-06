const dataStore = require('../store/data-store');
const { createSensorRecord, changeStatus, addWorkConditionPhoto, updateConclusion, createReworkVersion, addManualChange } = require('../models/sensor-record');
const { STATUS } = require('../models/boundary-rules');

let importBatchCounter = 0;

function importSensorData(rawDataList, operator = 'system') {
  importBatchCounter++;
  const batchId = `BATCH-${String(importBatchCounter).padStart(3, '0')}`;
  
  const records = rawDataList.map((rawData, index) => {
    return createSensorRecord(rawData, index + 1, batchId);
  });
  
  dataStore.addRecordBatch(records);
  
  return {
    batch_id: batchId,
    record_count: records.length,
    records: records.map(r => r.id)
  };
}

function engineerReview(recordId, operator, engineerNotes, photoUrls = []) {
  const record = dataStore.getRecordById(recordId);
  if (!record) throw new Error(`记录不存在: ${recordId}`);
  
  const allowedStatuses = [
    STATUS.STATUS_IMPORTED, 
    STATUS.QC_REJECTED, 
    STATUS.NEED_QC_REVIEW
  ];
  if (!allowedStatuses.includes(record.current_status)) {
    throw new Error(`当前状态 ${record.current_status} 不允许工程师评审`);
  }
  
  if (engineerNotes) {
    record.engineer_notes = engineerNotes;
    addManualChange(record, 'engineer_notes', null, engineerNotes, operator, '工程师评审备注');
  }
  
  photoUrls.forEach((url, idx) => {
    addWorkConditionPhoto(record, url, operator, `工况照片 ${idx + 1}`);
  });
  
  if (!record.qc_review_required && record.current_status !== STATUS.NEED_QC_REVIEW) {
    changeStatus(record, STATUS.STATUS_ENGINEER_REVIEWED, operator, '工程师完成评审');
  }
  
  dataStore.addRecord(record);
  return record;
}

function submitForQcReview(recordId, operator, remark = '') {
  const record = dataStore.getRecordById(recordId);
  if (!record) throw new Error(`记录不存在: ${recordId}`);
  
  if (record.current_status === STATUS.STATUS_ENGINEER_REVIEWED) {
    changeStatus(record, STATUS.NEED_QC_REVIEW, operator, remark || '提交质检员复核');
    dataStore.addRecord(record);
  }
  
  return record;
}

function qcApprove(recordId, operator, remark = '') {
  const record = dataStore.getRecordById(recordId);
  if (!record) throw new Error(`记录不存在: ${recordId}`);
  
  if (record.current_status !== STATUS.NEED_QC_REVIEW) {
    throw new Error(`当前状态 ${record.current_status} 不允许QC审批`);
  }
  
  changeStatus(record, STATUS.QC_APPROVED, operator, remark || '质检员复核通过');
  record.qc_review_required = false;
  dataStore.addRecord(record);
  return record;
}

function qcReject(recordId, operator, rejectReason) {
  const record = dataStore.getRecordById(recordId);
  if (!record) throw new Error(`记录不存在: ${recordId}`);
  
  if (record.current_status !== STATUS.NEED_QC_REVIEW) {
    throw new Error(`当前状态 ${record.current_status} 不允许QC驳回`);
  }
  
  changeStatus(record, STATUS.QC_REJECTED, operator, `QC驳回: ${rejectReason}`, { rejectReason });
  dataStore.addRecord(record);
  return record;
}

function finalizeConclusion(recordId, operator, conclusion) {
  const record = dataStore.getRecordById(recordId);
  if (!record) throw new Error(`记录不存在: ${recordId}`);
  
  if (record.current_status !== STATUS.STATUS_ENGINEER_REVIEWED && record.current_status !== STATUS.QC_APPROVED) {
    throw new Error(`当前状态 ${record.current_status} 不允许最终结论`);
  }
  
  updateConclusion(record, conclusion, operator, '最终结论确认');
  
  if (record.current_status === STATUS.QC_APPROVED) {
    changeStatus(record, STATUS.STATUS_FINALIZED, operator, '实验复盘图更新，结论最终确认');
  } else {
    changeStatus(record, STATUS.STATUS_FINALIZED, operator, '实验复盘图更新，结论最终确认');
  }
  
  dataStore.addRecord(record);
  return record;
}

function createRework(oldRecordId, operator, reworkReason, newPhotoUrls = []) {
  const oldRecord = dataStore.getRecordById(oldRecordId);
  if (!oldRecord) throw new Error(`记录不存在: ${oldRecordId}`);
  
  if (oldRecord.current_status !== STATUS.STATUS_FINALIZED) {
    throw new Error(`只有已终态的记录才能返工`);
  }
  
  const { newRecord, oldRecord: updatedOld } = createReworkVersion(oldRecord, operator, reworkReason);
  
  newPhotoUrls.forEach((url, idx) => {
    addWorkConditionPhoto(newRecord, url, operator, `返工补充工况照片 ${idx + 1}`);
  });
  
  dataStore.addRecord(updatedOld);
  dataStore.addRecord(newRecord);
  
  return {
    old_record_id: updatedOld.id,
    new_record_id: newRecord.id,
    rework_reason: reworkReason
  };
}

function replayAuditLog(recordId) {
  const record = dataStore.getRecordById(recordId);
  if (!record) throw new Error(`记录不存在: ${recordId}`);
  
  return {
    record_id: recordId,
    status_history: record.status_history,
    manual_changes: record.manual_changes,
    full_audit_log: dataStore.getAuditLog(recordId)
  };
}

function rollbackToVersion(recordId, statusIndex, operator) {
  const record = dataStore.getRecordById(recordId);
  if (!record) throw new Error(`记录不存在: ${recordId}`);
  
  if (statusIndex < 0 || statusIndex >= record.status_history.length) {
    throw new Error(`无效的历史版本索引`);
  }
  
  const targetStatus = record.status_history[statusIndex];
  
  record.manual_changes.push({
    field: 'rollback',
    old_value: record.current_status,
    new_value: targetStatus.status,
    operator,
    timestamp: new Date().toISOString(),
    reason: `回滚到版本 ${statusIndex} (${targetStatus.status})`
  });
  
  record.current_status = targetStatus.status;
  record.updated_at = new Date().toISOString();
  
  dataStore.addRecord(record);
  return record;
}

module.exports = {
  importSensorData,
  engineerReview,
  submitForQcReview,
  qcApprove,
  qcReject,
  finalizeConclusion,
  createRework,
  replayAuditLog,
  rollbackToVersion
};
