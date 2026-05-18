const STABLE_COLUMN_ORDER = [
  'recordId',
  'studyProgramId',
  'studyProgramName',
  'teamId',
  'teamName',
  'participantId',
  'participantName',
  'idCardNumber',
  'idCardType',
  'gender',
  'age',
  'phone',
  'emergencyContact',
  'emergencyPhone',
  'healthNotes',
  'insuranceStatus',
  'registrationDate',
  'status',
  'statusChangeDate',
  'operator',
  'remarks'
];

const STATUS_TYPES = {
  REGISTERED: '已报名',
  TEAM_ASSIGNED: '已分队',
  INSURED: '已投保',
  TEAM_CHANGED: '已改队',
  WITHDRAWN: '已退团',
  CANCELLED: '已取消'
};

const INSURANCE_STATUS = {
  PENDING: '待投保',
  PROCESSING: '投保中',
  SUCCESS: '投保成功',
  FAILED: '投保失败',
  REFUNDED: '已退保'
};

const OPERATION_TYPES = {
  CREATE: '创建记录',
  UPDATE: '更新信息',
  TEAM_CHANGE: '改队',
  WITHDRAW: '退团',
  INSURANCE_SUBMIT: '提交投保',
  INSURANCE_SUCCESS: '投保成功',
  INSURANCE_FAIL: '投保失败',
  ID_CARD_CORRECT: '身份证修正',
  REMARK: '添加备注'
};

function validateIdCard(idCardNumber) {
  if (!idCardNumber) return { valid: false, error: '身份证号为空', type: 'empty' };
  
  const cleanId = idCardNumber.trim().toUpperCase();
  
  if (cleanId.length === 15) {
    return { valid: true, type: '15位', note: '建议升级为18位身份证号', normalized: convert15To18(cleanId) };
  }
  
  if (cleanId.length === 18) {
    const pattern = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dX]$/;
    if (!pattern.test(cleanId)) {
      return { valid: false, error: '18位身份证号格式错误', type: 'format' };
    }
    if (!validateChecksum(cleanId)) {
      return { valid: false, error: '身份证校验码错误', type: 'checksum' };
    }
    return { valid: true, type: '18位', normalized: cleanId };
  }
  
  return { valid: false, error: `身份证号长度错误: ${cleanId.length}位`, type: 'length' };
}

function convert15To18(idCard15) {
  if (idCard15.length !== 15) return idCard15;
  const withCentury = idCard15.slice(0, 6) + '19' + idCard15.slice(6);
  const checksum = calculateChecksum(withCentury);
  return withCentury + checksum;
}

function calculateChecksum(idCard17) {
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idCard17[i]) * weights[i];
  }
  return checkCodes[sum % 11];
}

function validateChecksum(idCard18) {
  const body = idCard18.slice(0, 17);
  const expected = calculateChecksum(body);
  return idCard18[17] === expected;
}

function normalizeRecord(record) {
  const normalized = {};
  STABLE_COLUMN_ORDER.forEach(key => {
    normalized[key] = record[key] !== undefined ? record[key] : '';
  });
  
  if (normalized.idCardNumber) {
    const validation = validateIdCard(normalized.idCardNumber);
    if (validation.valid && validation.normalized) {
      normalized.idCardNumber = validation.normalized;
    }
  }
  
  return normalized;
}

function createRecordId(programId, participantId) {
  return `${programId}-${participantId}`;
}

module.exports = {
  STABLE_COLUMN_ORDER,
  STATUS_TYPES,
  INSURANCE_STATUS,
  OPERATION_TYPES,
  validateIdCard,
  convert15To18,
  normalizeRecord,
  createRecordId
};
