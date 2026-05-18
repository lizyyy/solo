const { SUPPLEMENT_STATUSES, STATUS_FLOW, REQUIRED_FIELDS } = require('../models/SupplementRecord');
const moment = require('moment');

const existingRecords = new Map();

function validateIdCard(idCard) {
  if (!idCard || idCard.length !== 18) return false;
  const regex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  return regex.test(idCard);
}

function validatePhone(phone) {
  const regex = /^1[3-9]\d{9}$/;
  return regex.test(phone);
}

function validateDate(dateStr) {
  return moment(dateStr, 'YYYY-MM-DD', true).isValid();
}

function isPersonalAddress(address, unitName) {
  if (!unitName) return false;
  const addressLower = address.toLowerCase();
  const unitNameLower = unitName.toLowerCase();
  return !addressLower.includes(unitNameLower.slice(0, 4)) &&
    (address.includes('小区') || address.includes('花园') ||
     address.includes('公寓') || address.includes('号楼') ||
     address.includes('室') || address.includes('村'));
}

const STATUS_ORDER = ['待审核', '已审核待打印', '已打印待寄出', '已寄出', '已签收'];

function checkLogConsistency(record, existingRecordsForBatch) {
  if (!existingRecordsForBatch || existingRecordsForBatch.length === 0) {
    return { consistent: true };
  }

  const currentApplyDate = moment(record.supplementApplyDate);
  const currentStatusIndex = STATUS_ORDER.indexOf(record.status);
  
  for (const existing of existingRecordsForBatch) {
    const existingApplyDate = moment(existing.supplementApplyDate);
    const existingStatusIndex = STATUS_ORDER.indexOf(existing.status);
    
    if (currentApplyDate.isBefore(existingApplyDate) && currentStatusIndex > existingStatusIndex) {
      return {
        consistent: false,
        reason: `与同批次记录状态时间线矛盾：当前记录申请日期(${record.supplementApplyDate})早于已有记录申请日期(${existing.supplementApplyDate})，但状态(${record.status})在已有记录状态(${existing.status})之后`
      };
    }
  }
  
  return { consistent: true };
}

function isDuplicate(record) {
  const key = `${record.batchNumber}-${record.examineeIdCard}`;
  return existingRecords.has(key);
}

function checkStatusJump(currentStatus, previousStatus = null) {
  if (!previousStatus) {
    return { valid: true };
  }
  
  const allowedNextStatuses = STATUS_FLOW[previousStatus] || [];
  if (!allowedNextStatuses.includes(currentStatus)) {
    return {
      valid: false,
      allowed: allowedNextStatuses
    };
  }
  
  return { valid: true };
}

function validateRecord(record, index, options = {}) {
  const errors = [];
  const warnings = [];
  const { ignoreWarnings = false, forceUpdate = false, previousRecords = [] } = options;

  for (const field of REQUIRED_FIELDS) {
    if (!record[field] || String(record[field]).trim() === '') {
      errors.push({
        rowIndex: index,
        originalData: record,
        errorReason: `必填字段为空: ${field}`,
        suggestion: `请补充 ${field} 字段的有效信息后重新导入`
      });
    }
  }

  if (record.reportType && !['个人', '单位团检'].includes(record.reportType)) {
    errors.push({
      rowIndex: index,
      originalData: record,
      errorReason: `报告类型无效: ${record.reportType}`,
      suggestion: '报告类型只能是 "个人" 或 "单位团检"'
    });
  }

  if (record.examineeIdCard && !validateIdCard(record.examineeIdCard)) {
    errors.push({
      rowIndex: index,
      originalData: record,
      errorReason: `身份证号格式无效: ${record.examineeIdCard}`,
      suggestion: '请输入有效的18位身份证号'
    });
  }

  if (record.examineePhone && !validatePhone(record.examineePhone)) {
    errors.push({
      rowIndex: index,
      originalData: record,
      errorReason: `手机号格式无效: ${record.examineePhone}`,
      suggestion: '请输入有效的11位手机号'
    });
  }

  if (record.status && !SUPPLEMENT_STATUSES.includes(record.status)) {
    errors.push({
      rowIndex: index,
      originalData: record,
      errorReason: `状态值无效: ${record.status}`,
      suggestion: `状态必须是以下值之一: ${SUPPLEMENT_STATUSES.join(', ')}`
    });
  }

  if (record.reportPrintDate && !validateDate(record.reportPrintDate)) {
    errors.push({
      rowIndex: index,
      originalData: record,
      errorReason: `报告打印日期格式无效: ${record.reportPrintDate}`,
      suggestion: '请使用 YYYY-MM-DD 格式的日期'
    });
  }

  if (record.supplementApplyDate && !validateDate(record.supplementApplyDate)) {
    errors.push({
      rowIndex: index,
      originalData: record,
      errorReason: `补寄申请日期格式无效: ${record.supplementApplyDate}`,
      suggestion: '请使用 YYYY-MM-DD 格式的日期'
    });
  }

  if (record.reportType === '单位团检' && record.unitName && record.correctedMailingAddress) {
    if (isPersonalAddress(record.correctedMailingAddress, record.unitName) && !ignoreWarnings) {
      warnings.push({
        rowIndex: index,
        originalData: record,
        warningReason: '单位团检报告拟寄往个人住宅地址',
        suggestion: '请确认是否为员工个人补寄需求，添加备注后可继续导入',
        allowContinueWithRemark: true
      });
    }
  }

  if (isDuplicate(record) && !forceUpdate) {
    errors.push({
      rowIndex: index,
      originalData: record,
      errorReason: '重复提交：该批次号和身份证号的补寄记录已存在',
      suggestion: '如需更新已有记录，请设置 forceUpdate: true，或使用其他批次号'
    });
  }

  const existingRecordsForBatch = previousRecords.filter(r => r.batchNumber === record.batchNumber);
  const consistencyCheck = checkLogConsistency(record, existingRecordsForBatch);
  if (!consistencyCheck.consistent && !ignoreWarnings) {
    warnings.push({
      rowIndex: index,
      originalData: record,
      warningReason: `补寄日志一致性警告: ${consistencyCheck.reason}`,
      suggestion: '请核查该批次内所有补寄记录的时间线，确认无误后添加备注可继续导入',
      allowContinueWithRemark: true
    });
  }

  const existingRecordForSamePerson = previousRecords.find(
    r => r.batchNumber === record.batchNumber && r.examineeIdCard === record.examineeIdCard
  );
  if (existingRecordForSamePerson && record.status) {
    const statusCheck = checkStatusJump(record.status, existingRecordForSamePerson.status);
    if (!statusCheck.valid) {
      errors.push({
        rowIndex: index,
        originalData: record,
        errorReason: `状态越级：无法从 "${existingRecordForSamePerson.status}" 直接变更为 "${record.status}"`,
        suggestion: `正确的状态流转顺序: ${existingRecordForSamePerson.status} → ${statusCheck.allowed.join(' 或 ')}`
      });
    }
  }

  return { errors, warnings, isValid: errors.length === 0 };
}

function addToExistingRecords(record) {
  const key = `${record.batchNumber}-${record.examineeIdCard}`;
  existingRecords.set(key, record);
}

module.exports = {
  validateRecord,
  validateIdCard,
  validatePhone,
  validateDate,
  isPersonalAddress,
  addToExistingRecords
};
