const { STATUS, canTransition, runAllBoundaryChecks } = require('./boundary-rules');

let recordCounter = 0;

function createSensorRecord(rawData, originalLineNo, importBatchId) {
  recordCounter++;
  const recordId = `REC-${String(recordCounter).padStart(3, '0')}`;
  const now = new Date().toISOString();
  
  const record = {
    id: recordId,
    original_line_no: originalLineNo,
    import_batch_id: importBatchId,
    created_at: now,
    updated_at: now,
    
    sensor_id: rawData.sensor_id,
    sensor_name: rawData.sensor_name,
    turbine_id: rawData.turbine_id,
    
    sampling_time: rawData.sampling_time,
    sampling_start_time: rawData.sampling_start_time || rawData.sampling_time,
    sampling_end_time: rawData.sampling_end_time || rawData.sampling_time,
    
    efficiency: rawData.efficiency,
    flow_rate: rawData.flow_rate,
    head: rawData.head,
    power: rawData.power,
    
    current_status: STATUS.STATUS_IMPORTED,
    status_history: [{
      status: STATUS.STATUS_IMPORTED,
      timestamp: now,
      operator: 'system',
      remark: '传感器数据导入'
    }],
    
    manual_changes: [],
    boundary_issues: [],
    qc_review_required: false,
    
    engineer_notes: null,
    work_condition_photos: [],
    conclusion: null,
    conclusion_version: 1,
    
    previous_versions: [],
    superseded_by: null
  };
  
  return record;
}

function addManualChange(record, field, oldValue, newValue, operator, reason) {
  record.manual_changes.push({
    field,
    old_value: oldValue,
    new_value: newValue,
    operator,
    timestamp: new Date().toISOString(),
    reason
  });
  record.updated_at = new Date().toISOString();
  return record;
}

function changeStatus(record, newStatus, operator, remark, extraData = {}) {
  if (!canTransition(record.current_status, newStatus)) {
    throw new Error(`状态流转不合法: ${record.current_status} → ${newStatus}`);
  }
  
  record.status_history.push({
    status: newStatus,
    timestamp: new Date().toISOString(),
    operator,
    remark,
    ...extraData
  });
  
  record.current_status = newStatus;
  record.updated_at = new Date().toISOString();
  
  if (newStatus === STATUS.NEED_QC_REVIEW) {
    record.qc_review_required = true;
  }
  
  return record;
}

function runBoundaryChecksOnRecord(record, previousRecord) {
  const result = runAllBoundaryChecks(record, previousRecord);
  record.boundary_issues = result.issues;
  
  if (result.hasIssues) {
    record.qc_review_required = true;
    if (record.current_status !== STATUS.NEED_QC_REVIEW) {
      changeStatus(
        record,
        STATUS.NEED_QC_REVIEW,
        'system',
        '边界规则检查发现问题，需质检员复核',
        { boundary_issues: result.issues }
      );
    }
  }
  
  return record;
}

function addWorkConditionPhoto(record, photoUrl, operator, remark) {
  record.work_condition_photos.push({
    url: photoUrl,
    uploaded_by: operator,
    uploaded_at: new Date().toISOString(),
    remark
  });
  record.updated_at = new Date().toISOString();
  return record;
}

function updateConclusion(record, newConclusion, operator, reason) {
  if (record.conclusion) {
    record.previous_versions.push({
      conclusion: record.conclusion,
      conclusion_version: record.conclusion_version,
      timestamp: record.updated_at,
      operator: record.status_history[record.status_history.length - 1]?.operator
    });
    
    if (record.current_status === STATUS.STATUS_FINALIZED) {
      changeStatus(record, STATUS.SUPERSEDED, operator, '旧结论被新结论替代');
    }
  }
  
  record.conclusion = newConclusion;
  record.conclusion_version += 1;
  record.updated_at = new Date().toISOString();
  
  addManualChange(record, 'conclusion', record.previous_versions.length > 0 ? record.previous_versions[record.previous_versions.length - 1].conclusion : null, newConclusion, operator, reason);
  
  return record;
}

function createReworkVersion(oldRecord, operator, reworkReason) {
  const newRecord = JSON.parse(JSON.stringify(oldRecord));
  
  newRecord.id = `${oldRecord.id}-V${oldRecord.conclusion_version + 1}`;
  newRecord.created_at = new Date().toISOString();
  newRecord.updated_at = new Date().toISOString();
  newRecord.current_status = STATUS.STATUS_ENGINEER_REVIEWED;
  newRecord.conclusion_version = 1;
  newRecord.previous_versions = [];
  newRecord.superseded_by = null;
  newRecord.conclusion = null;
  newRecord.engineer_notes = null;
  
  newRecord.status_history = [{
    status: STATUS.STATUS_ENGINEER_REVIEWED,
    timestamp: new Date().toISOString(),
    operator,
    remark: `返工创建，基于 ${oldRecord.id}，原因: ${reworkReason}`
  }];
  
  newRecord.manual_changes = [{
    field: 'rework_from',
    old_value: oldRecord.id,
    new_value: newRecord.id,
    operator,
    timestamp: new Date().toISOString(),
    reason: reworkReason
  }];
  
  return { newRecord, oldRecord };
}

module.exports = {
  createSensorRecord,
  addManualChange,
  changeStatus,
  runBoundaryChecksOnRecord,
  addWorkConditionPhoto,
  updateConclusion,
  createReworkVersion
};
