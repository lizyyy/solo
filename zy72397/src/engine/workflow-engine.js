const dataStore = require('../store/data-store');
const { createSensorRecord, changeStatus, addWorkConditionPhoto, updateConclusion, createReworkVersion, addManualChange, runBoundaryChecksOnRecord } = require('../models/sensor-record');
const { STATUS, deriveQcReviewRequired } = require('../models/boundary-rules');

let importBatchCounter = 0;

function importSensorData(rawDataList, operator = 'system') {
  importBatchCounter++;
  const batchId = `BATCH-${String(importBatchCounter).padStart(3, '0')}`;
  
  const records = rawDataList.map((rawData, index) => {
    return createSensorRecord(rawData, index + 1, batchId);
  });
  
  records.forEach((rec, i) => {
    const prev = i > 0 ? records[i - 1] : null;
    runBoundaryChecksOnRecord(rec, prev);
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
  // qc_review_required 由 changeStatus 内部调用 deriveQcReviewRequired() 自动同步，避免两套逻辑
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
    throw new Error(`无效的历史版本索引 [0, ${record.status_history.length - 1}]`);
  }

  const beforeStatus = record.current_status;
  const beforeQc = record.qc_review_required;
  const beforeBoundaryCount = (record.boundary_issues || []).length;

  const targetNode = record.status_history[statusIndex];
  const targetStatus = targetNode.status;
  const snap = targetNode.state_snapshot || {};

  // 恢复派生字段（重点要求：回滚不能只改current_status）
  // 1) qc_review_required: 先看快照，没快照就按状态派生
  if (typeof snap.qc_review_required === 'boolean') {
    record.qc_review_required = snap.qc_review_required;
  } else {
    record.qc_review_required = deriveQcReviewRequired(targetStatus, record);
  }
  // 2) boundary_issues: 快照中有的话就深拷贝还原（采样缺半小时的证据不能丢）
  if (snap.boundary_issues && Array.isArray(snap.boundary_issues)) {
    record.boundary_issues = JSON.parse(JSON.stringify(snap.boundary_issues));
  }
  // 3) conclusion: 还原
  if ('conclusion' in snap && typeof snap.conclusion !== 'undefined') {
    record.conclusion = snap.conclusion;
  }
  // 4) superseded_by: 还原
  if ('superseded_by' in snap) {
    record.superseded_by = snap.superseded_by || null;
  }

  // 审计追踪
  addManualChange(record, 'rollback',
    `${beforeStatus}|qc=${beforeQc}|issues=${beforeBoundaryCount}`,
    `${targetStatus}|qc=${record.qc_review_required}|issues=${(record.boundary_issues||[]).length}`,
    operator,
    `回滚到索引=${statusIndex} 对应状态=${targetStatus}; 同步派生字段 qc_review_required=${record.qc_review_required}; boundary_issues.length=${(record.boundary_issues||[]).length}`);

  // 最后走 changeStatus（allowRollback=true 允许跨状态跳），统一写入 status_history + state_snapshot
  changeStatus(record, targetStatus, operator,
    `执行回滚 (从 ${beforeStatus} 到 ${targetStatus})，目标索引=${statusIndex}; 节点备注=${targetNode.remark || ''}`,
    {
      allowRollback: true,
      rollback_from: beforeStatus,
      rollback_from_qc: beforeQc,
      rollback_to_qc: record.qc_review_required,
      rollback_index: statusIndex,
      rollback_target_node_timestamp: targetNode.timestamp
    });

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
