const REQUIRED_FIELDS = [
  'businessNo',
  'sampleId',
  'patientName',
  'patientAge',
  'patientGender',
  'sampleType',
  'testItem',
  'department',
  'collector',
  'collectTime'
];

const GATEWAY_ERROR_PATTERNS = [
  { code: 'GW001', pattern: /timeout/i, message: '网关超时' },
  { code: 'GW002', pattern: /connection refused/i, message: '连接被拒绝' },
  { code: 'GW003', pattern: /502|bad gateway/i, message: '网关错误' },
  { code: 'GW004', pattern: /504|gateway timeout/i, message: '网关超时' },
  { code: 'GW005', pattern: /network error/i, message: '网络错误' }
];

function detectMissingFields(parsedFields) {
  const missing = [];
  for (const field of REQUIRED_FIELDS) {
    if (!parsedFields || parsedFields[field] === undefined || parsedFields[field] === null || parsedFields[field] === '') {
      missing.push(field);
    }
  }
  return missing;
}

function detectDataAnomalies(sample) {
  const anomalies = [];
  
  if (sample.patientAge && (sample.patientAge < 0 || sample.patientAge > 150)) {
    anomalies.push({
      type: 'invalid_age',
      field: 'patientAge',
      value: sample.patientAge,
      message: '年龄超出有效范围(0-150)'
    });
  }
  
  if (sample.collectTime && sample.receiveTime) {
    const collectDate = new Date(sample.collectTime);
    const receiveDate = new Date(sample.receiveTime);
    if (receiveDate < collectDate) {
      anomalies.push({
        type: 'time_inversion',
        fields: ['collectTime', 'receiveTime'],
        values: [sample.collectTime, sample.receiveTime],
        message: '接收时间早于采集时间'
      });
    }
  }
  
  return anomalies;
}

function detectGatewayErrors(logContent) {
  const errors = [];
  for (const { code, pattern, message } of GATEWAY_ERROR_PATTERNS) {
    if (pattern.test(logContent)) {
      errors.push({
        code,
        message,
        detectedAt: new Date().toISOString()
      });
    }
  }
  return errors;
}

function auditRawInputs(rawInputs) {
  const auditResults = {
    totalRows: rawInputs.length,
    cleanRows: 0,
    dirtyRows: 0,
    swallowedRows: 0,
    malformedRows: 0,
    anomalies: [],
    details: []
  };

  for (const rawInput of rawInputs) {
    const detail = {
      index: rawInput.index,
      businessNo: rawInput.businessNo,
      isDirty: rawInput.isDirty || false,
      dirtyType: rawInput.dirtyType || null,
      originalLine: rawInput.originalLine,
      rawContent: rawInput.rawContent,
      missingFields: [],
      anomalies: [],
      status: 'clean'
    };

    if (rawInput.isDirty) {
      auditResults.dirtyRows++;
      detail.status = 'dirty';
      
      if (rawInput.dirtyType === 'swallowed') {
        auditResults.swallowedRows++;
        detail.missingFields = rawInput.missingFields || [];
      } else if (rawInput.dirtyType === 'malformed') {
        auditResults.malformedRows++;
        detail.missingFields = rawInput.missingFields || [];
      }
      
      auditResults.anomalies.push({
        businessNo: rawInput.businessNo,
        type: rawInput.dirtyType,
        message: rawInput.errorMessage,
        rawContent: rawInput.rawContent
      });
    } else {
      const missingFields = detectMissingFields(rawInput.parsedFields);
      if (missingFields.length > 0) {
        detail.isDirty = true;
        detail.dirtyType = 'missing_fields';
        detail.missingFields = missingFields;
        detail.status = 'dirty';
        auditResults.dirtyRows++;
        auditResults.anomalies.push({
          businessNo: rawInput.businessNo,
          type: 'missing_fields',
          message: `缺失字段: ${missingFields.join(', ')}`,
          missingFields
        });
      } else {
        auditResults.cleanRows++;
      }
    }
    
    auditResults.details.push(detail);
  }

  return auditResults;
}

function auditSamples(samples) {
  const auditResults = {
    totalSamples: samples.length,
    samplesWithAnomalies: 0,
    cleanSamples: 0,
    anomalies: [],
    details: []
  };

  for (const sample of samples) {
    const anomalies = detectDataAnomalies(sample);
    
    const detail = {
      businessNo: sample.businessNo,
      sampleId: sample.sampleId,
      hasAnomalies: anomalies.length > 0,
      anomalies,
      rawInputIndex: sample.rawInputIndex
    };

    if (anomalies.length > 0) {
      auditResults.samplesWithAnomalies++;
      for (const anomaly of anomalies) {
        auditResults.anomalies.push({
          businessNo: sample.businessNo,
          sampleId: sample.sampleId,
          ...anomaly
        });
      }
    } else {
      auditResults.cleanSamples++;
    }
    
    auditResults.details.push(detail);
  }

  return auditResults;
}

function fullAudit(data) {
  const rawAudit = auditRawInputs(data.rawInputs);
  const sampleAudit = auditSamples(data.samples);
  
  return {
    batchId: data.batchId,
    operator: data.operator,
    auditTime: new Date().toISOString(),
    summary: {
      totalRawRows: rawAudit.totalRows,
      cleanRows: rawAudit.cleanRows,
      dirtyRows: rawAudit.dirtyRows,
      swallowedRows: rawAudit.swallowedRows,
      malformedRows: rawAudit.malformedRows,
      totalSamples: sampleAudit.totalSamples,
      cleanSamples: sampleAudit.cleanSamples,
      samplesWithAnomalies: sampleAudit.samplesWithAnomalies
    },
    rawAudit,
    sampleAudit,
    allAnomalies: [
      ...rawAudit.anomalies,
      ...sampleAudit.anomalies.map(a => ({
        ...a,
        type: 'data_anomaly'
      }))
    ]
  };
}

export {
  detectMissingFields,
  detectDataAnomalies,
  detectGatewayErrors,
  auditRawInputs,
  auditSamples,
  fullAudit,
  REQUIRED_FIELDS,
  GATEWAY_ERROR_PATTERNS
};
