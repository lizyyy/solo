const { TestDrive, AccidentRecord, OperationLog } = require('../models');
const {
  generateAccidentNo,
  validateAccidentTime,
  validateRecordConsistency,
  checkForConflicts,
  determineFinalStatus
} = require('./validationService');

async function createAccidentRecord(accidentData, operator = 'system', ipAddress = null) {
  const testDrive = await TestDrive.findByPk(accidentData.testDriveId);
  if (!testDrive) {
    throw {
      code: 'TEST_DRIVE_NOT_FOUND',
      message: `试驾记录ID(${accidentData.testDriveId})不存在`,
      status: 404
    };
  }

  const timeValidation = await validateAccidentTime(accidentData, testDrive);
  const consistencyValidation = await validateRecordConsistency(accidentData, testDrive);
  const conflicts = await checkForConflicts(accidentData.testDriveId, accidentData.accidentTime);

  const allErrors = [...timeValidation.errors, ...consistencyValidation.errors];
  const allWarnings = [...timeValidation.warnings, ...consistencyValidation.warnings];

  if (conflicts.length > 0) {
    allWarnings.push({
      code: 'POTENTIAL_DUPLICATE',
      message: conflicts.map(c => c.message).join('; '),
      suggestion: '请核实是否为重复登记。如确为新事故，请说明与已有记录的关系；如为重复，请撤销本次登记',
      severity: 'high',
      conflicts
    });
  }

  const statusResult = determineFinalStatus({ errors: allErrors, warnings: allWarnings });

  const accidentNo = accidentData.accidentNo || generateAccidentNo();

  const accidentRecord = await AccidentRecord.create({
    ...accidentData,
    accidentNo,
    status: statusResult.status,
    reviewReason: statusResult.reason,
    reportTime: accidentData.reportTime || new Date(),
    versionNumber: 1,
    modificationCount: 0
  });

  await OperationLog.create({
    accidentRecordId: accidentRecord.id,
    operationType: 'create',
    operator,
    afterData: accidentRecord.toJSON(),
    changes: Object.keys(accidentData),
    reason: '新建事故记录',
    ipAddress
  });

  if (statusResult.status === 'rejected') {
    return {
      success: false,
      code: 'VALIDATION_FAILED',
      message: '事故记录创建失败，存在校验错误',
      data: accidentRecord.toJSON(),
      errors: allErrors,
      warnings: allWarnings,
      suggestions: statusResult.suggestions || []
    };
  }

  return {
    success: true,
    code: statusResult.status === 'pending_processing' ? 'PENDING_PROCESSING' : 'CREATED',
    message: statusResult.status === 'pending_processing' 
      ? '事故记录已创建，但因存在高风险问题需转入人工待处理' 
      : '事故记录创建成功，待审核',
    data: accidentRecord.toJSON(),
    warnings: allWarnings,
    suggestions: statusResult.suggestions || []
  };
}

async function updateAccidentRecord(id, updateData, operator = 'system', ipAddress = null) {
  const existingRecord = await AccidentRecord.findByPk(id);
  if (!existingRecord) {
    throw {
      code: 'ACCIDENT_RECORD_NOT_FOUND',
      message: `事故记录ID(${id})不存在`,
      status: 404
    };
  }

  if (['approved', 'closed'].includes(existingRecord.status)) {
    throw {
      code: 'RECORD_NOT_MODIFIABLE',
      message: `已${existingRecord.status === 'approved' ? '审核通过' : '结案'}的记录不能修改`,
      status: 400
    };
  }

  const testDrive = await TestDrive.findByPk(existingRecord.testDriveId);

  const beforeData = existingRecord.toJSON();

  const timeValidation = await validateAccidentTime(
    { ...existingRecord.toJSON(), ...updateData },
    testDrive
  );
  const consistencyValidation = await validateRecordConsistency(
    updateData,
    testDrive,
    existingRecord
  );

  const allErrors = [...timeValidation.errors, ...consistencyValidation.errors];
  const allWarnings = [...timeValidation.warnings, ...consistencyValidation.warnings];

  if (allErrors.length > 0) {
    return {
      success: false,
      code: 'VALIDATION_FAILED',
      message: '事故记录更新失败，存在校验错误',
      errors: allErrors,
      warnings: allWarnings
    };
  }

  const statusResult = determineFinalStatus({ errors: allErrors, warnings: allWarnings });

  const changes = [];
  Object.keys(updateData).forEach(key => {
    if (existingRecord[key] !== updateData[key]) {
      changes.push(key);
    }
  });

  await existingRecord.update({
    ...updateData,
    status: statusResult.status,
    reviewReason: statusResult.reason,
    modificationCount: existingRecord.modificationCount + 1
  });

  await OperationLog.create({
    accidentRecordId: existingRecord.id,
    operationType: 'update',
    operator,
    beforeData,
    afterData: existingRecord.toJSON(),
    changes,
    reason: '更新事故记录',
    ipAddress
  });

  return {
    success: true,
    code: statusResult.status === 'pending_processing' ? 'PENDING_PROCESSING' : 'UPDATED',
    message: statusResult.status === 'pending_processing'
      ? '事故记录已更新，但因存在高风险问题需转入人工待处理'
      : '事故记录更新成功',
    data: existingRecord.toJSON(),
    warnings: allWarnings,
    suggestions: statusResult.suggestions || []
  };
}

async function getAccidentRecord(id) {
  const record = await AccidentRecord.findByPk(id, {
    include: [{
      model: TestDrive,
      as: 'TestDrive'
    }]
  });

  if (!record) {
    throw {
      code: 'ACCIDENT_RECORD_NOT_FOUND',
      message: `事故记录ID(${id})不存在`,
      status: 404
    };
  }

  const logs = await OperationLog.findAll({
    where: { accidentRecordId: id },
    order: [['createdAt', 'DESC']]
  });

  return {
    ...record.toJSON(),
    operationLogs: logs.map(log => log.toJSON())
  };
}

async function getAccidentRecords(filters = {}) {
  const where = {};
  
  if (filters.testDriveId) where.testDriveId = filters.testDriveId;
  if (filters.status) where.status = filters.status;
  if (filters.accidentNo) where.accidentNo = filters.accidentNo;

  const records = await AccidentRecord.findAll({
    where,
    include: [{
      model: TestDrive,
      as: 'TestDrive'
    }],
    order: [['createdAt', 'DESC']]
  });

  return records.map(r => r.toJSON());
}

async function reviewAccidentRecord(id, reviewData, operator) {
  const record = await AccidentRecord.findByPk(id);
  if (!record) {
    throw {
      code: 'ACCIDENT_RECORD_NOT_FOUND',
      message: `事故记录ID(${id})不存在`,
      status: 404
    };
  }

  const beforeData = record.toJSON();

  await record.update({
    status: reviewData.status,
    reviewReason: reviewData.reason,
    reviewer: operator,
    reviewTime: new Date()
  });

  await OperationLog.create({
    accidentRecordId: record.id,
    operationType: reviewData.status === 'approved' ? 'approve' : 'reject',
    operator,
    beforeData,
    afterData: record.toJSON(),
    changes: ['status', 'reviewReason', 'reviewer', 'reviewTime'],
    reason: reviewData.reason
  });

  return {
    success: true,
    message: `记录已${reviewData.status === 'approved' ? '审核通过' : '驳回'}`,
    data: record.toJSON()
  };
}

module.exports = {
  createAccidentRecord,
  updateAccidentRecord,
  getAccidentRecord,
  getAccidentRecords,
  reviewAccidentRecord
};
