const { loadStore, saveStore, generateId } = require('./store');

function addAuditLog(action, operator, details) {
  const store = loadStore();
  const log = {
    id: generateId('audit'),
    action,
    operator,
    details,
    timestamp: new Date().toISOString()
  };
  store.auditLogs.push(log);
  saveStore(store);
  return log;
}

function importDesensitizationRule(data, operator) {
  const store = loadStore();
  const rule = {
    id: generateId('rule'),
    name: data.name,
    remark: data.remark,
    mainProcess: data.mainProcess,
    content: data.content,
    importedBy: operator,
    importedAt: new Date().toISOString(),
    status: 'imported'
  };
  store.desensitizationRules.push(rule);
  saveStore(store);
  addAuditLog('import_rule', operator, { ruleId: rule.id, name: rule.name });
  return rule;
}

function addGrayBatch(data, operator) {
  const store = loadStore();
  const batch = {
    id: generateId('batch'),
    batchNo: data.batchNo,
    sceneStatement: data.sceneStatement,
    relatedRuleId: data.relatedRuleId,
    content: data.content,
    addedBy: operator,
    addedAt: new Date().toISOString()
  };
  store.grayBatches.push(batch);
  saveStore(store);
  addAuditLog('add_gray_batch', operator, { batchId: batch.id, batchNo: batch.batchNo });
  return batch;
}

function getDesensitizationRules() {
  return loadStore().desensitizationRules;
}

function getGrayBatches() {
  return loadStore().grayBatches;
}

function getAuditLogs() {
  return loadStore().auditLogs;
}

function getInspectionRecords() {
  return loadStore().inspectionRecords;
}

function getExportResults() {
  return loadStore().exportResults;
}

function getPhoneMaskIssues() {
  return loadStore().phoneMaskIssues;
}

function saveInspectionRecord(record) {
  const store = loadStore();
  store.inspectionRecords.push(record);
  saveStore(store);
  return record;
}

function saveExportResult(result) {
  const store = loadStore();
  store.exportResults.push(result);
  saveStore(store);
  return result;
}

function savePhoneMaskIssue(issue) {
  const store = loadStore();
  store.phoneMaskIssues.push(issue);
  saveStore(store);
  return issue;
}

function updatePhoneMaskIssue(issueId, updates, operator) {
  const store = loadStore();
  const idx = store.phoneMaskIssues.findIndex(i => i.id === issueId);
  if (idx === -1) return null;
  const old = { ...store.phoneMaskIssues[idx] };
  store.phoneMaskIssues[idx] = { ...store.phoneMaskIssues[idx], ...updates };
  saveStore(store);
  addAuditLog('update_phone_issue', operator, { issueId, oldStatus: old.status, newStatus: updates.status, ...updates });
  return store.phoneMaskIssues[idx];
}

function updateExportResult(exportId, updates, operator) {
  const store = loadStore();
  const idx = store.exportResults.findIndex(e => e.id === exportId);
  if (idx === -1) return null;
  const old = { ...store.exportResults[idx] };
  store.exportResults[idx] = { ...store.exportResults[idx], ...updates };
  saveStore(store);
  addAuditLog('update_export', operator, { exportId, old, updates });
  return store.exportResults[idx];
}

function clearAllData() {
  const initial = {
    desensitizationRules: [],
    grayBatches: [],
    inspectionRecords: [],
    exportResults: [],
    auditLogs: [],
    phoneMaskIssues: []
  };
  saveStore(initial);
}

module.exports = {
  addAuditLog,
  importDesensitizationRule,
  addGrayBatch,
  getDesensitizationRules,
  getGrayBatches,
  getAuditLogs,
  getInspectionRecords,
  getExportResults,
  getPhoneMaskIssues,
  saveInspectionRecord,
  saveExportResult,
  savePhoneMaskIssue,
  updatePhoneMaskIssue,
  updateExportResult,
  clearAllData,
  generateId
};
