const { readFiles } = require('./fileReaderService');
const { validateRules } = require('./validationService');

const NORMAL = 'normal';
const PENDING = 'pendingConfirmation';
const FAILED = 'failed';

function createRecord(type, data, issues = []) {
  return {
    type,
    data: { ...data },
    issues,
    issueCount: issues.length
  };
}

function createFailedRecord(type, data, failureReason, suggestion) {
  return {
    type,
    originalData: { ...data },
    failureReason,
    suggestion,
    failureCode: failureReason.code || 'UNKNOWN'
  };
}

async function processInspectionData(files, body) {
  const fileData = await readFiles(files);
  
  const result = {
    normal: [],
    pendingConfirmation: [],
    failed: []
  };

  fileData.inspectionRecords.forEach(record => {
    processRecord('inspection', record, result);
  });

  fileData.sensorData.forEach(record => {
    processRecord('sensor', record, result);
  });

  fileData.approvalRecords.forEach(record => {
    processRecord('approval', record, result);
  });

  if (body && Object.keys(body).length > 0 && !body.__proto__) {
    processRecord('manual', body, result);
  }

  return result;
}

function processRecord(type, record, result) {
  const validation = validateRules(type, record);

  if (validation.status === NORMAL) {
    result.normal.push(createRecord(type, record, validation.issues));
  } else if (validation.status === PENDING) {
    result.pendingConfirmation.push(createRecord(type, record, validation.issues));
  } else {
    result.failed.push(createFailedRecord(
      type,
      record,
      validation.mainFailure,
      validation.suggestion
    ));
  }
}

module.exports = {
  processInspectionData
};
