const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const moment = require('moment');

const DIRTY_TYPES = {
  MISSING_FIELD: 'missing_field',
  CROSS_DATE: 'cross_date',
  NAME_CHANGE: 'name_change',
  CONFLICT: 'conflict',
  PLATE_MISMATCH: 'plate_mismatch',
  TIME_ANOMALY: 'time_anomaly'
};

function classifyDirtyRecord(recordType, record, relatedRecords = []) {
  const issues = [];
  
  const missingFields = checkMissingFields(recordType, record);
  if (missingFields.length > 0) {
    issues.push({
      type: DIRTY_TYPES.MISSING_FIELD,
      reason: `缺少必填字段: ${missingFields.join(', ')}`,
      severity: 'high',
      fields: missingFields
    });
  }
  
  if (record.visit_date || record.pass_time || record.capture_time) {
    const dateIssue = checkCrossDate(record, relatedRecords);
    if (dateIssue) {
      issues.push(dateIssue);
    }
  }
  
  if (record.visitor_name && relatedRecords.length > 0) {
    const nameIssue = checkNameChange(record.visitor_name, relatedRecords);
    if (nameIssue) {
      issues.push(nameIssue);
    }
  }
  
  const conflictIssue = checkValueConflicts(record, relatedRecords);
  if (conflictIssue) {
    issues.push(conflictIssue);
  }
  
  if (record.license_plate || record.recognized_plate) {
    const plateIssue = checkPlateMismatch(record);
    if (plateIssue) {
      issues.push(plateIssue);
    }
  }
  
  return issues;
}

function checkMissingFields(recordType, record) {
  const requiredFields = {
    appointment: ['appointment_no', 'visitor_name', 'visit_date'],
    gate: ['record_no', 'pass_time'],
    screenshot: ['screenshot_no', 'license_plate', 'capture_time']
  };
  
  const required = requiredFields[recordType] || [];
  return required.filter(field => !record[field] && record[field] !== 0);
}

function checkCrossDate(record, relatedRecords) {
  const recordDate = extractDate(record);
  if (!recordDate) return null;
  
  for (const related of relatedRecords) {
    const relatedDate = extractDate(related);
    if (relatedDate && !moment(recordDate).isSame(relatedDate, 'day')) {
      return {
        type: DIRTY_TYPES.CROSS_DATE,
        reason: `跨日期不一致: 记录日期 ${recordDate} vs 关联日期 ${relatedDate}`,
        severity: 'high'
      };
    }
  }
  
  return null;
}

function extractDate(record) {
  if (record.visit_date) return record.visit_date;
  if (record.pass_time) return record.pass_time.split(' ')[0];
  if (record.capture_time) return record.capture_time.split(' ')[0];
  return null;
}

function checkNameChange(currentName, relatedRecords) {
  const relatedNames = relatedRecords
    .map(r => r.visitor_name)
    .filter(n => n && n !== currentName);
  
  if (relatedNames.length > 0) {
    return {
      type: DIRTY_TYPES.NAME_CHANGE,
      reason: `姓名不一致: 当前 "${currentName}" vs 关联记录 "${relatedNames[0]}"`,
      severity: 'medium'
    };
  }
  
  return null;
}

function checkValueConflicts(record, relatedRecords) {
  const conflictFields = [];
  const fieldsToCheck = ['license_plate', 'id_card', 'visit_reason'];
  
  for (const field of fieldsToCheck) {
    if (record[field]) {
      const conflicts = relatedRecords.filter(
        r => r[field] && r[field] !== record[field]
      );
      if (conflicts.length > 0) {
        conflictFields.push(field);
      }
    }
  }
  
  if (conflictFields.length > 0) {
    return {
      type: DIRTY_TYPES.CONFLICT,
      reason: `字段值冲突: ${conflictFields.join(', ')}`,
      severity: 'high',
      fields: conflictFields
    };
  }
  
  return null;
}

function checkPlateMismatch(record) {
  if (record.license_plate && record.recognized_plate) {
    if (record.license_plate !== record.recognized_plate) {
      return {
        type: DIRTY_TYPES.PLATE_MISMATCH,
        reason: `车牌识别不匹配: 预约车牌 ${record.license_plate} vs 识别车牌 ${record.recognized_plate}`,
        severity: 'medium'
      };
    }
  }
  return null;
}

function createDirtyRecord(recordType, recordNo, issue, originalData, factId = null) {
  const db = getDatabase();
  const recordId = `dirty_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  
  const stmt = db.prepare(`
    INSERT INTO dirty_records (
      record_id, record_type, record_no, fact_id, dirty_type,
      dirty_reason, severity, original_data, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);
  
  stmt.run(
    recordId,
    recordType,
    recordNo,
    factId,
    issue.type,
    issue.reason,
    issue.severity,
    JSON.stringify(originalData)
  );
  
  return recordId;
}

module.exports = {
  DIRTY_TYPES,
  classifyDirtyRecord,
  createDirtyRecord,
  checkMissingFields,
  checkCrossDate,
  checkNameChange,
  checkValueConflicts,
  checkPlateMismatch
};
