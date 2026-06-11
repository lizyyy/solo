const { STATUS, canTransition, runAllBoundaryChecks, deriveQcReviewRequired } = require('./boundary-rules');

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
      remark: '传感器数据导入',
      state_snapshot: {
        qc_review_required: false,
        boundary_issues: [],
        conclusion: null,
        superseded_by: null,
        previous_versions_count: 0
      }
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
  const { allowRollback, skipSnapshot = false } = extraData;
  if (!canTransition(record.current_status, newStatus, { allowRollback })) {
    throw new Error(`状态流转不合法: ${record.current_status} → ${newStatus}`);
  }
  
  const transitionData = {
    status: newStatus,
    timestamp: new Date().toISOString(),
    operator,
    remark,
    ...Object.fromEntries(
      Object.entries(extraData).filter(([k]) => k !== 'allowRollback' && k !== 'skipSnapshot')
    )
  };
  
  if (!skipSnapshot) {
    transitionData.state_snapshot = {
      qc_review_required: deriveQcReviewRequired(newStatus, record),
      boundary_issues: JSON.parse(JSON.stringify(record.boundary_issues || [])),
      conclusion: record.conclusion,
      superseded_by: record.superseded_by,
      previous_versions_count: (record.previous_versions || []).length
    };
  }
  
  record.status_history.push(transitionData);
  
  record.current_status = newStatus;
  record.updated_at = new Date().toISOString();
  
  record.qc_review_required = deriveQcReviewRequired(newStatus, record);
  
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
    } else {
      // 已处于 NEED_QC_REVIEW，仍要刷新 state_snapshot，把边界问题写入快照
      // 做法：手动追加一条状态快照到末尾节点
      const lastNode = record.status_history[record.status_history.length - 1];
      if (lastNode && lastNode.status === STATUS.NEED_QC_REVIEW) {
        lastNode.state_snapshot = {
          qc_review_required: true,
          boundary_issues: JSON.parse(JSON.stringify(record.boundary_issues || [])),
          conclusion: record.conclusion,
          superseded_by: record.superseded_by,
          previous_versions_count: (record.previous_versions || []).length
        };
      }
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
  const now = new Date().toISOString();
  const newId = `${oldRecord.id}-V${oldRecord.conclusion_version + 1}`;

  oldRecord.previous_versions.push({
    conclusion: oldRecord.conclusion,
    conclusion_version: oldRecord.conclusion_version,
    timestamp: oldRecord.updated_at,
    operator: oldRecord.status_history[oldRecord.status_history.length - 1]?.operator
  });
  oldRecord.superseded_by = newId;
  oldRecord.manual_changes.push({
    field: 'superseded_by',
    old_value: null,
    new_value: newId,
    operator,
    timestamp: now,
    reason: `返工创建新记录替代本结论，原因: ${reworkReason}`
  });
  changeStatus(oldRecord, STATUS.SUPERSEDED, operator, `结论返工，被 ${newId} 替代`, {
    reworkReason,
    superseded_by: newId,
    old_conclusion: oldRecord.conclusion
  });

  const newRecord = JSON.parse(JSON.stringify(oldRecord));
  newRecord.id = newId;
  newRecord.created_at = now;
  newRecord.updated_at = now;
  newRecord.current_status = STATUS.STATUS_ENGINEER_REVIEWED;
  newRecord.conclusion_version = 1;
  newRecord.previous_versions = [{
    conclusion: oldRecord.conclusion,
    conclusion_version: oldRecord.conclusion_version,
    timestamp: oldRecord.updated_at,
    operator: operator,
    superseded_from: oldRecord.id
  }];
  newRecord.superseded_by = null;
  newRecord.conclusion = null;
  newRecord.engineer_notes = null;
  newRecord.status_history = [{
    status: STATUS.STATUS_ENGINEER_REVIEWED,
    timestamp: now,
    operator,
    remark: `返工创建，基于 ${oldRecord.id}，原因: ${reworkReason}`,
    rework_from: oldRecord.id,
    reworkReason
  }];
  newRecord.manual_changes = [{
    field: 'rework_from',
    old_value: oldRecord.id,
    new_value: newRecord.id,
    operator,
    timestamp: now,
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
