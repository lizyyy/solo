const { 
  BATCHES_FILE, 
  SAMPLES_FILE, 
  TEST_ITEMS_FILE, 
  REPORTS_FILE, 
  USAGES_FILE,
  HISTORY_FILE,
  BATCH_STATUS, 
  REPORT_STATUS, 
  readJsonFile, 
  writeJsonFile, 
  addHistoryRecord 
} = require('../utils/storage');

const { v4: uuidv4 } = require('uuid');

function getBatches() {
  return readJsonFile(BATCHES_FILE) || [];
}

function getBatchById(batchNo) {
  const batches = getBatches();
  return batches.find(b => b.batchNo === batchNo);
}

function saveBatch(batch, operator = 'system') {
  const batches = getBatches();
  const existingIndex = batches.findIndex(b => b.batchNo === batch.batchNo);
  
  if (existingIndex >= 0) {
    const oldBatch = batches[existingIndex];
    const changes = {
      before: oldBatch,
      after: batch
    };
    batches[existingIndex] = batch;
    addHistoryRecord('UPDATE', 'BATCH', batch.batchNo, changes, operator);
  } else {
    batches.push(batch);
    addHistoryRecord('CREATE', 'BATCH', batch.batchNo, { before: null, after: batch }, operator);
  }
  
  writeJsonFile(BATCHES_FILE, batches);
  return batch;
}

function getSamples() {
  return readJsonFile(SAMPLES_FILE) || [];
}

function getSampleById(sampleId) {
  const samples = getSamples();
  return samples.find(s => s.id === sampleId || s.sampleNo === sampleId);
}

function getSamplesByBatch(batchNo) {
  const samples = getSamples();
  return samples.filter(s => s.batchNo === batchNo);
}

function saveSample(sample, operator = 'system') {
  const samples = getSamples();
  const existingIndex = samples.findIndex(s => s.id === sample.id);
  
  if (existingIndex >= 0) {
    const oldSample = samples[existingIndex];
    const changes = {
      before: oldSample,
      after: sample
    };
    samples[existingIndex] = sample;
    addHistoryRecord('UPDATE', 'SAMPLE', sample.id, changes, operator);
  } else {
    samples.push(sample);
    addHistoryRecord('CREATE', 'SAMPLE', sample.id, { before: null, after: sample }, operator);
  }
  
  writeJsonFile(SAMPLES_FILE, samples);
  return sample;
}

function getTestItems() {
  return readJsonFile(TEST_ITEMS_FILE) || [];
}

function getTestItemsByBatch(batchNo) {
  const items = getTestItems();
  return items.filter(i => i.batchNo === batchNo);
}

function saveTestItem(item, operator = 'system') {
  const items = getTestItems();
  const existingIndex = items.findIndex(i => i.id === item.id);
  
  if (existingIndex >= 0) {
    const oldItem = items[existingIndex];
    const changes = {
      before: oldItem,
      after: item
    };
    items[existingIndex] = item;
    addHistoryRecord('UPDATE', 'TEST_ITEM', item.id, changes, operator);
  } else {
    items.push(item);
    addHistoryRecord('CREATE', 'TEST_ITEM', item.id, { before: null, after: item }, operator);
  }
  
  writeJsonFile(TEST_ITEMS_FILE, items);
  return item;
}

function getReports() {
  return readJsonFile(REPORTS_FILE) || [];
}

function getReportById(reportId) {
  const reports = getReports();
  return reports.find(r => r.id === reportId || r.reportNo === reportId);
}

function getReportsByBatch(batchNo) {
  const reports = getReports();
  return reports.filter(r => r.batchNo === batchNo);
}

function getLatestReport(batchNo) {
  const reports = getReportsByBatch(batchNo);
  if (reports.length === 0) return null;
  return reports.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))[0];
}

function saveReport(report, operator = 'system') {
  const reports = getReports();
  const existingIndex = reports.findIndex(r => r.reportNo === report.reportNo);
  
  if (existingIndex >= 0) {
    const oldReport = reports[existingIndex];
    const changes = {
      before: oldReport,
      after: report
    };
    reports[existingIndex] = report;
    addHistoryRecord('OVERWRITE', 'REPORT', report.reportNo, changes, operator);
  } else {
    reports.push(report);
    addHistoryRecord('CREATE', 'REPORT', report.reportNo, { before: null, after: report }, operator);
  }
  
  writeJsonFile(REPORTS_FILE, reports);
  return report;
}

function getUsages() {
  return readJsonFile(USAGES_FILE) || [];
}

function getUsagesByBatch(batchNo) {
  const usages = getUsages();
  return usages.filter(u => u.batchNo === batchNo);
}

function saveUsage(usage, operator = 'system') {
  const usages = getUsages();
  const existingIndex = usages.findIndex(u => u.id === usage.id);
  
  if (existingIndex >= 0) {
    const oldUsage = usages[existingIndex];
    const changes = {
      before: oldUsage,
      after: usage
    };
    usages[existingIndex] = usage;
    addHistoryRecord('UPDATE', 'USAGE', usage.id, changes, operator);
  } else {
    usages.push(usage);
    addHistoryRecord('CREATE', 'USAGE', usage.id, { before: null, after: usage }, operator);
  }
  
  writeJsonFile(USAGES_FILE, usages);
  return usage;
}

function getHistory(entityType = null, entityId = null) {
  const history = readJsonFile(HISTORY_FILE) || [];
  if (!entityType) return history;
  return history.filter(h => 
    h.entityType === entityType && 
    (!entityId || h.entityId === entityId)
  );
}

function registerBatch(data, operator = 'system') {
  const existing = getBatchById(data.batchNo);
  if (existing) {
    return { success: false, error: '批次号已存在，不允许重复进场' };
  }
  
  const batch = {
    id: uuidv4(),
    batchNo: data.batchNo,
    materialType: data.materialType,
    materialName: data.materialName,
    specification: data.specification,
    quantity: data.quantity,
    unit: data.unit,
    supplier: data.supplier,
    productionBatch: data.productionBatch,
    productionDate: data.productionDate,
    arrivalDate: data.arrivalDate || new Date().toISOString().split('T')[0],
    location: data.location,
    inspector: data.inspector,
    status: BATCH_STATUS.REGISTERED,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    remark: data.remark || ''
  };
  
  saveBatch(batch, operator);
  return { success: true, data: batch };
}

function registerSample(data, operator = 'system') {
  const batch = getBatchById(data.batchNo);
  if (!batch) {
    return { success: false, error: '进场批次不存在' };
  }
  
  const sample = {
    id: uuidv4(),
    sampleNo: data.sampleNo || `SMP-${Date.now()}`,
    batchNo: data.batchNo,
    sampler: data.sampler,
    witness: data.witness,
    samplingDate: data.samplingDate || new Date().toISOString().split('T')[0],
    samplingLocation: data.samplingLocation,
    samplingQuantity: data.samplingQuantity,
    deliveryToLab: data.deliveryToLab || false,
    deliveryDate: data.deliveryDate,
    remark: data.remark || '',
    createdAt: new Date().toISOString()
  };
  
  saveSample(sample, operator);
  
  batch.status = BATCH_STATUS.SAMPLING;
  batch.updatedAt = new Date().toISOString();
  saveBatch(batch, operator);
  
  return { success: true, data: sample };
}

function registerTestItem(data, operator = 'system') {
  const batch = getBatchById(data.batchNo);
  if (!batch) {
    return { success: false, error: '进场批次不存在' };
  }
  
  const item = {
    id: uuidv4(),
    batchNo: data.batchNo,
    testItem: data.testItem,
    testStandard: data.testStandard,
    requiredValue: data.requiredValue,
    lab: data.lab,
    expectedDate: data.expectedDate,
    result: null,
    isQualified: null,
    remark: data.remark || '',
    createdAt: new Date().toISOString()
  };
  
  saveTestItem(item, operator);
  
  batch.status = BATCH_STATUS.PENDING_REPORT;
  batch.updatedAt = new Date().toISOString();
  saveBatch(batch, operator);
  
  return { success: true, data: item };
}

function submitReport(data, operator = 'system') {
  const batch = getBatchById(data.batchNo);
  if (!batch) {
    return { success: false, error: '进场批次不存在' };
  }
  
  const existingReport = getReportById(data.reportNo);
  if (existingReport) {
    if (existingReport.batchNo !== data.batchNo) {
      return { 
        success: false, 
        error: `报告批次号不匹配：报告编号 ${data.reportNo} 已绑定批次 ${existingReport.batchNo}，不能绑定 ${data.batchNo}` 
      };
    }
  }
  
  const report = {
    id: uuidv4(),
    reportNo: data.reportNo,
    batchNo: data.batchNo,
    reportDate: data.reportDate,
    receivedAt: data.receivedAt || new Date().toISOString(),
    lab: data.lab,
    inspector: data.inspector,
    conclusion: data.conclusion,
    isQualified: data.isQualified,
    filePath: data.filePath,
    remark: data.remark || '',
    isReinspection: data.isReinspection || false,
    relatedReportNo: data.relatedReportNo,
    createdAt: new Date().toISOString()
  };
  
  saveReport(report, operator);
  
  const testItems = getTestItemsByBatch(data.batchNo);
  if (data.testResults && Array.isArray(data.testResults)) {
    data.testResults.forEach(result => {
      const item = testItems.find(t => t.testItem === result.testItem);
      if (item) {
        item.result = result.actualValue;
        item.isQualified = result.isQualified;
        item.reportNo = data.reportNo;
        saveTestItem(item, operator);
      }
    });
  }
  
  if (data.isQualified) {
    batch.status = BATCH_STATUS.QUALIFIED;
  } else {
    batch.status = BATCH_STATUS.FROZEN;
    batch.freezeReason = `不合格报告：${data.reportNo}`;
  }
  batch.updatedAt = new Date().toISOString();
  saveBatch(batch, operator);
  
  return { success: true, data: report, duplicated: !!existingReport };
}

function submitReinspectionReport(data, operator = 'system') {
  if (!data.relatedReportNo) {
    return { success: false, error: '复检报告必须关联原始不合格报告编号' };
  }
  
  const originalReport = getReportById(data.relatedReportNo);
  if (!originalReport) {
    return { success: false, error: '原始报告不存在' };
  }
  
  data.isReinspection = true;
  const result = submitReport(data, operator);
  
  if (result.success && result.data.isQualified) {
    const batch = getBatchById(data.batchNo);
    batch.status = BATCH_STATUS.QUALIFIED;
    batch.freezeReason = null;
    batch.unfreezeReason = `复检合格：${data.reportNo}`;
    batch.updatedAt = new Date().toISOString();
    saveBatch(batch, operator);
    
    result.data.batchStatusUpdated = true;
  }
  
  return result;
}

function registerUsage(data, operator = 'system') {
  const batch = getBatchById(data.batchNo);
  if (!batch) {
    return { success: false, error: '进场批次不存在' };
  }
  
  const usage = {
    id: uuidv4(),
    batchNo: data.batchNo,
    usageDate: data.usageDate || new Date().toISOString().split('T')[0],
    usedQuantity: data.usedQuantity,
    usedLocation: data.usedLocation,
    user: data.user,
    remark: data.remark || '',
    isViolation: false,
    createdAt: new Date().toISOString()
  };
  
  const latestReport = getLatestReport(data.batchNo);
  const isQualified = latestReport && latestReport.isQualified;
  
  if (!isQualified) {
    usage.isViolation = true;
    batch.status = BATCH_STATUS.VIOLATION;
    batch.violationReason = `违规使用：${data.usedQuantity} ${batch.unit} 于 ${usage.usageDate}`;
    batch.updatedAt = new Date().toISOString();
    saveBatch(batch, operator);
  }
  
  saveUsage(usage, operator);
  
  return { 
    success: true, 
    data: usage,
    isViolation: usage.isViolation,
    message: usage.isViolation ? '警告：未检测合格已使用，标记为违规' : '正常使用记录'
  };
}

function manualCorrection(entityType, entityId, updates, operator, reason) {
  if (!operator || operator === 'system') {
    return { success: false, error: '人工修正必须指定操作者' };
  }
  if (!reason) {
    return { success: false, error: '人工修正必须说明原因' };
  }
  
  let entity;
  let saveFn;
  
  switch (entityType.toUpperCase()) {
    case 'BATCH':
      entity = getBatchById(entityId);
      saveFn = saveBatch;
      break;
    case 'SAMPLE':
      entity = getSampleById(entityId);
      saveFn = saveSample;
      break;
    case 'TEST_ITEM':
      const items = getTestItems();
      entity = items.find(i => i.id === entityId);
      saveFn = (e) => {
        const items = getTestItems();
        const idx = items.findIndex(i => i.id === e.id);
        if (idx >= 0) {
          const old = items[idx];
          const changes = { before: old, after: e };
          items[idx] = e;
          addHistoryRecord('CORRECT', 'TEST_ITEM', e.id, changes, operator, reason);
          writeJsonFile(TEST_ITEMS_FILE, items);
          return e;
        }
        return e;
      };
      break;
    case 'REPORT':
      entity = getReportById(entityId);
      saveFn = (e) => {
        const reports = getReports();
        const idx = reports.findIndex(r => r.reportNo === e.reportNo);
        if (idx >= 0) {
          const old = reports[idx];
          const changes = { before: old, after: e };
          reports[idx] = e;
          addHistoryRecord('CORRECT', 'REPORT', e.reportNo, changes, operator, reason);
          writeJsonFile(REPORTS_FILE, reports);
          return e;
        }
        return e;
      };
      break;
    default:
      return { success: false, error: '不支持的实体类型' };
  }
  
  if (!entity) {
    return { success: false, error: '实体不存在' };
  }
  
  const changes = {
    before: JSON.parse(JSON.stringify(entity)),
    after: { ...entity, ...updates }
  };
  
  addHistoryRecord('CORRECT', entityType.toUpperCase(), entityId, changes, operator, reason);
  
  const updatedEntity = { ...entity, ...updates, updatedAt: new Date().toISOString() };
  saveFn(updatedEntity, operator);
  
  return { success: true, data: updatedEntity, changes };
}

function checkBatchStatus(batchNo) {
  const batch = getBatchById(batchNo);
  if (!batch) {
    return { success: false, error: '批次不存在' };
  }
  
  const samples = getSamplesByBatch(batchNo);
  const testItems = getTestItemsByBatch(batchNo);
  const reports = getReportsByBatch(batchNo);
  const usages = getUsagesByBatch(batchNo);
  const history = getHistory('BATCH', batchNo);
  
  const latestReport = getLatestReport(batchNo);
  const isQualified = latestReport && latestReport.isQualified;
  const violationUsages = usages.filter(u => u.isViolation);
  
  const issues = [];
  
  if (batch.status !== BATCH_STATUS.QUALIFIED && usages.length > 0) {
    issues.push({
      type: 'VIOLATION',
      severity: 'HIGH',
      message: `批次 ${batchNo} 未检测合格但已使用 ${usages.length} 次`
    });
  }
  
  if (reports.length > 0) {
    const batchNos = [...new Set(reports.map(r => r.batchNo))];
    if (batchNos.length > 1) {
      issues.push({
        type: 'BATCH_MISMATCH',
        severity: 'MEDIUM',
        message: '报告批次号不匹配'
      });
    }
  }
  
  if (batch.status === BATCH_STATUS.FROZEN) {
    issues.push({
      type: 'FROZEN',
      severity: 'MEDIUM',
      message: `批次已冻结：${batch.freezeReason || '未知原因'}`
    });
  }
  
  const pendingItems = testItems.filter(i => i.result === null);
  if (pendingItems.length > 0 && batch.status === BATCH_STATUS.PENDING_REPORT) {
    issues.push({
      type: 'PENDING',
      severity: 'LOW',
      message: `${pendingItems.length} 项检测结果待回传`
    });
  }
  
  return {
    success: true,
    data: {
      batch,
      samples,
      testItems,
      reports,
      usages,
      history,
      latestReport,
      isQualified,
      violationUsages,
      issues,
      summary: {
        status: batch.status,
        sampleCount: samples.length,
        testItemCount: testItems.length,
        reportCount: reports.length,
        usageCount: usages.length,
        issueCount: issues.length,
        hasViolation: violationUsages.length > 0
      }
    }
  };
}

function getBatchesByStatus(status) {
  const batches = getBatches();
  if (!status) return batches;
  return batches.filter(b => b.status === status);
}

function getAllBatchesSummary() {
  const batches = getBatches();
  const statusGroups = {};
  
  Object.values(BATCH_STATUS).forEach(status => {
    statusGroups[status] = [];
  });
  
  batches.forEach(batch => {
    if (!statusGroups[batch.status]) {
      statusGroups[batch.status] = [];
    }
    statusGroups[batch.status].push(batch);
  });
  
  const summary = {
    total: batches.length,
    byStatus: {},
    qualified: 0,
    pendingReport: 0,
    frozen: 0,
    violation: 0
  };
  
  Object.keys(statusGroups).forEach(status => {
    summary.byStatus[status] = statusGroups[status].length;
    if (status === BATCH_STATUS.QUALIFIED) summary.qualified = statusGroups[status].length;
    if (status === BATCH_STATUS.PENDING_REPORT) summary.pendingReport = statusGroups[status].length;
    if (status === BATCH_STATUS.FROZEN) summary.frozen = statusGroups[status].length;
    if (status === BATCH_STATUS.VIOLATION) summary.violation = statusGroups[status].length;
  });
  
  return {
    success: true,
    data: {
      summary,
      batches,
      statusGroups
    }
  };
}

module.exports = {
  BATCH_STATUS,
  REPORT_STATUS,
  getBatches,
  getBatchById,
  saveBatch,
  getSamples,
  getSampleById,
  getSamplesByBatch,
  saveSample,
  getTestItems,
  getTestItemsByBatch,
  saveTestItem,
  getReports,
  getReportById,
  getReportsByBatch,
  getLatestReport,
  saveReport,
  getUsages,
  getUsagesByBatch,
  saveUsage,
  getHistory,
  registerBatch,
  registerSample,
  registerTestItem,
  submitReport,
  submitReinspectionReport,
  registerUsage,
  manualCorrection,
  checkBatchStatus,
  getBatchesByStatus,
  getAllBatchesSummary
};
