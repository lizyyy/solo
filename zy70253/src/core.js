const { parseFile, toJSON } = require('./parser');
const {
  validateAccessLogRow,
  validateTemperatureRow,
  validateBatchRow,
  validateShiftRow,
  validateThresholdConfig
} = require('./validator');
const {
  processAccessLogs,
  analyzeTemperatureCurve,
  correlateDoorAndTemperature,
  assignShiftToCorrelations,
  matchBatchesToEvents,
  generateFinalReport,
  DEFAULT_CONFIG
} = require('./analyzer');

function validateAndFilterData(rows, validatorFn, dataType) {
  const valid = [];
  const skipped = [];
  const needsReview = [];
  
  rows.forEach(row => {
    const { errors, warnings } = validatorFn(row.data, row.lineNumber);
    
    if (errors.length > 0) {
      skipped.push({
        lineNumber: row.lineNumber,
        data: row.data,
        errors
      });
    } else {
      valid.push(row);
      if (warnings.length > 0) {
        needsReview.push({
          lineNumber: row.lineNumber,
          data: row.data,
          warnings
        });
      }
    }
  });
  
  return { valid, skipped, needsReview, total: rows.length };
}

function processAllData(options) {
  const result = {
    status: 'unknown',
    accessLog: null,
    temperature: null,
    batches: null,
    shifts: null,
    report: null,
    validationSummary: {
      accessLog: { total: 0, valid: 0, skipped: 0, needsReview: 0 },
      temperature: { total: 0, valid: 0, skipped: 0, needsReview: 0 },
      batches: { total: 0, valid: 0, skipped: 0, needsReview: 0 },
      shifts: { total: 0, valid: 0, skipped: 0, needsReview: 0 }
    }
  };
  
  let config = { ...DEFAULT_CONFIG };
  if (options.config) {
    try {
      const configData = parseFile(options.config);
      const configValidation = validateThresholdConfig(configData.rows[0]?.data || {});
      if (configValidation.errors.length > 0) {
        throw new Error(`配置文件错误: ${configValidation.errors.join('; ')}`);
      }
      config = { ...config, ...(configData.rows[0]?.data || {}) };
    } catch (e) {
      throw new Error(`读取配置文件失败: ${e.message}`);
    }
  }
  
  if (options.accessLog) {
    const accessData = parseFile(options.accessLog);
    const accessResult = validateAndFilterData(accessData.rows, validateAccessLogRow, 'accessLog');
    result.accessLog = accessResult;
    result.validationSummary.accessLog = {
      total: accessResult.total,
      valid: accessResult.valid.length,
      skipped: accessResult.skipped.length,
      needsReview: accessResult.needsReview.length
    };
  }
  
  if (options.temperature) {
    const tempData = parseFile(options.temperature);
    const tempResult = validateAndFilterData(tempData.rows, validateTemperatureRow, 'temperature');
    result.temperature = tempResult;
    result.validationSummary.temperature = {
      total: tempResult.total,
      valid: tempResult.valid.length,
      skipped: tempResult.skipped.length,
      needsReview: tempResult.needsReview.length
    };
  }
  
  if (options.batches) {
    const batchData = parseFile(options.batches);
    const batchResult = validateAndFilterData(batchData.rows, validateBatchRow, 'batches');
    result.batches = batchResult;
    result.validationSummary.batches = {
      total: batchResult.total,
      valid: batchResult.valid.length,
      skipped: batchResult.skipped.length,
      needsReview: batchResult.needsReview.length
    };
  }
  
  if (options.shifts) {
    const shiftData = parseFile(options.shifts);
    const shiftResult = validateAndFilterData(shiftData.rows, validateShiftRow, 'shifts');
    result.shifts = shiftResult;
    result.validationSummary.shifts = {
      total: shiftResult.total,
      valid: shiftResult.valid.length,
      skipped: shiftResult.skipped.length,
      needsReview: shiftResult.needsReview.length
    };
  }
  
  const canGenerateReport = result.accessLog && result.temperature && 
    result.accessLog.valid.length > 0 && result.temperature.valid.length > 0;
  
  if (canGenerateReport) {
    const accessProcessed = processAccessLogs(result.accessLog.valid, config);
    const tempAnalysis = analyzeTemperatureCurve(result.temperature.valid, config);
    const correlations = correlateDoorAndTemperature(accessProcessed.doorOpenEvents, tempAnalysis, config);
    
    const withShifts = assignShiftToCorrelations(
      correlations, 
      result.shifts ? result.shifts.valid : []
    );
    
    const withBatches = matchBatchesToEvents(
      withShifts,
      result.batches ? result.batches.valid : []
    );
    
    result.report = generateFinalReport(accessProcessed, tempAnalysis, correlations, withBatches);
    
    const hasSkipped = Object.values(result.validationSummary).some(v => v.skipped > 0);
    const needsManualReview = result.report.summary.needsManualReview > 0;
    
    if (hasSkipped) {
      result.status = 'failed';
    } else if (needsManualReview) {
      result.status = 'needs_manual_review';
    } else {
      result.status = 'passed';
    }
  } else {
    const hasAnyData = result.accessLog || result.temperature || result.batches || result.shifts;
    if (hasAnyData) {
      result.status = 'partial';
    }
  }
  
  return result;
}

module.exports = {
  validateAndFilterData,
  processAllData
};
