const moment = require('moment');
const { Op } = require('sequelize');
const { TestDrive, AccidentRecord } = require('../models');

const MAX_REPORT_DELAY_HOURS = 24;
const MAX_MODIFICATION_COUNT = 5;

function generateAccidentNo() {
  const date = moment().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ACC-${date}-${random}`;
}

function generateTestDriveNo() {
  const date = moment().format('YYYYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TD-${date}-${random}`;
}

async function validateAccidentTime(accidentData, testDrive) {
  const errors = [];
  const warnings = [];

  const accidentTime = moment(accidentData.accidentTime);
  const reportTime = moment(accidentData.reportTime || new Date());
  const testDriveStart = moment(testDrive.startTime);
  const testDriveEnd = testDrive.endTime ? moment(testDrive.endTime) : null;

  if (accidentTime.isBefore(testDriveStart)) {
    errors.push({
      code: 'ACCIDENT_TIME_BEFORE_TESTDRIVE',
      message: `事故发生时间(${accidentTime.format('YYYY-MM-DD HH:mm:ss')})早于试驾开始时间(${testDriveStart.format('YYYY-MM-DD HH:mm:ss')})，时间逻辑异常`,
      suggestion: '请核实事故发生时间，确保事故发生在试驾期间内。如确为试驾前事故，请走非试驾事故登记流程'
    });
  }

  if (testDriveEnd && accidentTime.isAfter(testDriveEnd)) {
    const hoursAfter = accidentTime.diff(testDriveEnd, 'hours');
    if (hoursAfter > MAX_REPORT_DELAY_HOURS) {
      warnings.push({
        code: 'ACCIDENT_TIME_AFTER_TESTDRIVE_SUSPICIOUS',
        message: `事故发生时间(${accidentTime.format('YYYY-MM-DD HH:mm:ss')})在试驾结束(${testDriveEnd.format('YYYY-MM-DD HH:mm:ss')})后${hoursAfter}小时，已超过${MAX_REPORT_DELAY_HOURS}小时可信补报窗口`,
        suggestion: '事故时间可信度低，需转入人工审核。请补充：1) 延迟报案原因说明；2) 事故现场照片时间戳证明；3) 当事人证词',
        severity: 'high'
      });
    } else {
      warnings.push({
        code: 'ACCIDENT_TIME_AFTER_TESTDRIVE',
        message: `事故发生时间(${accidentTime.format('YYYY-MM-DD HH:mm:ss')})在试驾结束(${testDriveEnd.format('YYYY-MM-DD HH:mm:ss')})后${hoursAfter}小时`,
        suggestion: '需确认事故是否与试驾相关，请补充试驾结束后的车辆使用情况说明',
        severity: 'medium'
      });
    }
  }

  if (accidentTime.isAfter(reportTime)) {
    errors.push({
      code: 'ACCIDENT_TIME_AFTER_REPORT',
      message: `事故发生时间(${accidentTime.format('YYYY-MM-DD HH:mm:ss')})晚于报案时间(${reportTime.format('YYYY-MM-DD HH:mm:ss')})，时间逻辑异常`,
      suggestion: '请核实事故发生时间和报案时间，确保时间顺序正确'
    });
  }

  const hoursSinceAccident = moment().diff(accidentTime, 'hours');
  if (hoursSinceAccident > 72) {
    warnings.push({
      code: 'LATE_REPORT',
      message: `距事故发生已${hoursSinceAccident}小时，超过72小时报案窗口期`,
      suggestion: '延迟报案可能影响保险理赔，请尽快补充完整事故材料并说明延迟原因',
      severity: 'medium'
    });
  }

  return { errors, warnings };
}

async function validateRecordConsistency(accidentData, testDrive, existingRecord = null) {
  const errors = [];
  const warnings = [];

  if (existingRecord) {
    const modificationCount = existingRecord.modificationCount + 1;
    
    if (modificationCount > MAX_MODIFICATION_COUNT) {
      warnings.push({
        code: 'EXCESSIVE_MODIFICATIONS',
        message: `该记录已修改${existingRecord.modificationCount}次，本次为第${modificationCount}次修改，超过${MAX_MODIFICATION_COUNT}次阈值`,
        suggestion: '频繁修改记录可能影响数据可信度，需转入人工审核。请说明反复修改的原因，并提供最终版的完整事故材料',
        severity: 'high'
      });
    }

    const changedFields = [];
    const criticalFields = ['accidentTime', 'accidentType', 'accidentSeverity', 'accidentDescription', 'liability'];
    
    criticalFields.forEach(field => {
      if (accidentData[field] !== undefined && 
          JSON.stringify(accidentData[field]) !== JSON.stringify(existingRecord[field])) {
        changedFields.push(field);
      }
    });

    if (changedFields.length > 0) {
      warnings.push({
        code: 'CRITICAL_FIELDS_MODIFIED',
        message: `关键字段被修改：${changedFields.join(', ')}`,
        suggestion: '关键字段修改需重新审核，请说明修改原因并提供相关佐证材料',
        severity: 'high',
        changedFields
      });
    }
  }

  if (accidentData.driverName && accidentData.driverName !== testDrive.customerName) {
    warnings.push({
      code: 'DRIVER_MISMATCH',
      message: `事故驾驶员(${accidentData.driverName})与试驾登记客户(${testDrive.customerName})不一致`,
      suggestion: '请确认驾驶员身份，提供驾驶员驾驶证信息及与试驾客户的关系说明',
      severity: 'medium'
    });
  }

  if (accidentData.hasInjury && !accidentData.injuryDescription) {
    errors.push({
      code: 'INJURY_DESCRIPTION_REQUIRED',
      message: '已标记有人员受伤，但未填写受伤情况描述',
      suggestion: '请详细填写受伤人员情况，包括受伤部位、受伤程度、就医情况等'
    });
  }

  if (accidentData.policeCalled && !accidentData.policeReportNo) {
    warnings.push({
      code: 'POLICE_REPORT_NO_MISSING',
      message: '已标记报警，但未填写报警编号',
      suggestion: '请补充交警出具的事故认定书编号',
      severity: 'low'
    });
  }

  if (accidentData.insuranceCalled && !accidentData.insuranceReportNo) {
    warnings.push({
      code: 'INSURANCE_REPORT_NO_MISSING',
      message: '已标记报保险，但未填写保险报案号',
      suggestion: '请补充保险公司报案号',
      severity: 'low'
    });
  }

  return { errors, warnings };
}

async function checkForConflicts(testDriveId, accidentTime) {
  const conflicts = [];
  
  const existingRecords = await AccidentRecord.findAll({
    where: {
      testDriveId,
      status: {
        [Op.notIn]: ['rejected', 'closed']
      }
    }
  });

  if (existingRecords.length > 0) {
    const timeWindowStart = moment(accidentTime).subtract(1, 'hour');
    const timeWindowEnd = moment(accidentTime).add(1, 'hour');

    existingRecords.forEach(record => {
      const recordTime = moment(record.accidentTime);
      if (recordTime.isBetween(timeWindowStart, timeWindowEnd)) {
        conflicts.push({
          recordId: record.id,
          accidentNo: record.accidentNo,
          accidentTime: record.accidentTime,
          accidentType: record.accidentType,
          message: `同一次试驾在相近时间(${recordTime.format('YYYY-MM-DD HH:mm:ss')})已有事故记录(${record.accidentNo})，存在重复登记风险`
        });
      }
    });
  }

  return conflicts;
}

function determineFinalStatus(validationResult) {
  const { errors, warnings } = validationResult;
  
  if (errors.length > 0) {
    return {
      status: 'rejected',
      reason: errors.map(e => e.message).join('; '),
      details: errors
    };
  }

  const highSeverityWarnings = warnings.filter(w => w.severity === 'high');
  
  if (highSeverityWarnings.length > 0) {
    return {
      status: 'pending_processing',
      reason: highSeverityWarnings.map(w => w.message).join('; '),
      suggestions: warnings.map(w => w.suggestion),
      details: warnings
    };
  }

  if (warnings.length > 0) {
    return {
      status: 'pending_review',
      reason: warnings.map(w => w.message).join('; '),
      suggestions: warnings.map(w => w.suggestion),
      details: warnings
    };
  }

  return {
    status: 'pending_review',
    reason: '待审核',
    details: []
  };
}

module.exports = {
  generateAccidentNo,
  generateTestDriveNo,
  validateAccidentTime,
  validateRecordConsistency,
  checkForConflicts,
  determineFinalStatus,
  MAX_REPORT_DELAY_HOURS,
  MAX_MODIFICATION_COUNT
};
