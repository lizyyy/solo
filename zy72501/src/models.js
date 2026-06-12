const { loadStore, saveStore, generateId } = require('./store');

function addAuditLog(action, operator, details, changeHistory = null) {
  const store = loadStore();
  const log = {
    id: generateId('audit'),
    action,
    operator,
    details,
    timestamp: new Date().toISOString()
  };
  if (changeHistory) {
    log.changeHistory = changeHistory;
  }
  store.auditLogs.push(log);
  saveStore(store);
  return log;
}

function buildChangeHistory(oldValue, newValue, fieldName, reason = null) {
  const changed = JSON.stringify(oldValue) !== JSON.stringify(newValue);
  if (!changed) return null;
  return {
    field: fieldName,
    oldValue: oldValue,
    newValue: newValue,
    changeReason: reason,
    changedAt: new Date().toISOString(),
    diff: {
      type: typeof oldValue === 'string' && typeof newValue === 'string' ? 'text' : 'value',
      oldLength: typeof oldValue === 'string' ? oldValue.length : undefined,
      newLength: typeof newValue === 'string' ? newValue.length : undefined
    }
  };
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
    status: 'imported',
    versionHistory: [{
      version: 1,
      timestamp: new Date().toISOString(),
      modifiedBy: operator,
      changeReason: data.importReason || '首次导入',
      snapshot: {
        name: data.name,
        remark: data.remark,
        mainProcess: data.mainProcess,
        content: data.content
      }
    }],
    currentVersion: 1
  };
  store.desensitizationRules.push(rule);
  saveStore(store);
  addAuditLog('import_rule', operator, { 
    ruleId: rule.id, 
    name: rule.name,
    initialRemark: data.remark,
    initialMainProcess: data.mainProcess
  });
  return rule;
}

function updateDesensitizationRule(ruleId, updates, operator, changeReason = null) {
  const store = loadStore();
  const idx = store.desensitizationRules.findIndex(r => r.id === ruleId);
  if (idx === -1) return null;
  
  const oldRule = { ...store.desensitizationRules[idx] };
  const changeHistories = [];
  
  const fieldsToCheck = ['name', 'remark', 'mainProcess', 'content', 'status'];
  fieldsToCheck.forEach(field => {
    if (updates[field] !== undefined && updates[field] !== oldRule[field]) {
      const history = buildChangeHistory(
        oldRule[field], 
        updates[field], 
        field, 
        changeReason
      );
      if (history) {
        changeHistories.push(history);
      }
    }
  });
  
  if (changeHistories.length === 0) {
    return oldRule;
  }
  
  const newVersion = (oldRule.currentVersion || 1) + 1;
  const newRule = {
    ...oldRule,
    ...updates,
    currentVersion: newVersion,
    versionHistory: [
      ...(oldRule.versionHistory || []),
      {
        version: newVersion,
        timestamp: new Date().toISOString(),
        modifiedBy: operator,
        changeReason: changeReason || '更新内容',
        changes: changeHistories,
        snapshot: {
          name: updates.name !== undefined ? updates.name : oldRule.name,
          remark: updates.remark !== undefined ? updates.remark : oldRule.remark,
          mainProcess: updates.mainProcess !== undefined ? updates.mainProcess : oldRule.mainProcess,
          content: updates.content !== undefined ? updates.content : oldRule.content
        }
      }
    ]
  };
  
  store.desensitizationRules[idx] = newRule;
  saveStore(store);
  
  addAuditLog('update_rule', operator, {
    ruleId,
    oldName: oldRule.name,
    newName: newRule.name,
    changeCount: changeHistories.length,
    changeReason
  }, changeHistories);
  
  return newRule;
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
    addedAt: new Date().toISOString(),
    versionHistory: [{
      version: 1,
      timestamp: new Date().toISOString(),
      modifiedBy: operator,
      changeReason: data.addReason || '首次补录',
      snapshot: {
        batchNo: data.batchNo,
        sceneStatement: data.sceneStatement,
        relatedRuleId: data.relatedRuleId,
        content: data.content
      }
    }],
    currentVersion: 1
  };
  store.grayBatches.push(batch);
  saveStore(store);
  addAuditLog('add_gray_batch', operator, { 
    batchId: batch.id, 
    batchNo: batch.batchNo,
    initialSceneStatement: data.sceneStatement,
    relatedRuleId: data.relatedRuleId
  });
  return batch;
}

function updateGrayBatch(batchId, updates, operator, changeReason = null) {
  const store = loadStore();
  const idx = store.grayBatches.findIndex(b => b.id === batchId);
  if (idx === -1) return null;
  
  const oldBatch = { ...store.grayBatches[idx] };
  const changeHistories = [];
  
  const fieldsToCheck = ['batchNo', 'sceneStatement', 'relatedRuleId', 'content'];
  fieldsToCheck.forEach(field => {
    if (updates[field] !== undefined && updates[field] !== oldBatch[field]) {
      const history = buildChangeHistory(
        oldBatch[field], 
        updates[field], 
        field, 
        changeReason
      );
      if (history) {
        changeHistories.push(history);
      }
    }
  });
  
  if (changeHistories.length === 0) {
    return oldBatch;
  }
  
  const newVersion = (oldBatch.currentVersion || 1) + 1;
  const newBatch = {
    ...oldBatch,
    ...updates,
    currentVersion: newVersion,
    versionHistory: [
      ...(oldBatch.versionHistory || []),
      {
        version: newVersion,
        timestamp: new Date().toISOString(),
        modifiedBy: operator,
        changeReason: changeReason || '更新内容',
        changes: changeHistories,
        snapshot: {
          batchNo: updates.batchNo !== undefined ? updates.batchNo : oldBatch.batchNo,
          sceneStatement: updates.sceneStatement !== undefined ? updates.sceneStatement : oldBatch.sceneStatement,
          relatedRuleId: updates.relatedRuleId !== undefined ? updates.relatedRuleId : oldBatch.relatedRuleId,
          content: updates.content !== undefined ? updates.content : oldBatch.content
        }
      }
    ]
  };
  
  store.grayBatches[idx] = newBatch;
  saveStore(store);
  
  addAuditLog('update_gray_batch', operator, {
    batchId,
    oldBatchNo: oldBatch.batchNo,
    newBatchNo: newBatch.batchNo,
    changeCount: changeHistories.length,
    changeReason
  }, changeHistories);
  
  return newBatch;
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

function getDesensitizationRuleById(ruleId) {
  return loadStore().desensitizationRules.find(r => r.id === ruleId) || null;
}

function getGrayBatchById(batchId) {
  return loadStore().grayBatches.find(b => b.id === batchId) || null;
}

function getInspectionById(inspectionId) {
  return loadStore().inspectionRecords.find(i => i.id === inspectionId) || null;
}

function traceBackByTraceId(traceId) {
  const store = loadStore();
  const result = {
    traceId,
    found: false,
    sources: []
  };
  
  store.inspectionRecords.forEach(inspection => {
    inspection.gaps?.forEach(gap => {
      if (gap.traceId === traceId) {
        result.found = true;
        result.sources.push({
          type: 'inspection_gap',
          inspectionId: inspection.id,
          inspectionDate: inspection.createdAt,
          gapType: gap.type,
          gapDescription: gap.description,
          rawMaterialSnapshot: gap.rawMaterialSnapshot,
          ruleId: gap.ruleId,
          batchId: gap.batchId,
          operator: inspection.operator
        });
      }
    });
    inspection.phoneIssues?.forEach(issue => {
      if (issue.traceId === traceId) {
        result.found = true;
        result.sources.push({
          type: 'phone_issue',
          inspectionId: inspection.id,
          inspectionDate: inspection.createdAt,
          phoneNumber: issue.phoneNumber,
          sourceType: issue.sourceType,
          sourceName: issue.sourceName,
          rawMaterialSnapshot: issue.rawMaterialSnapshot,
          sourceId: issue.sourceId,
          operator: inspection.operator
        });
      }
    });
  });
  
  store.phoneMaskIssues.forEach(issue => {
    if (issue.traceId === traceId) {
      result.found = true;
      result.sources.push({
        type: 'phone_mask_issue_record',
        issueId: issue.id,
        phoneNumber: issue.phoneNumber,
        status: issue.status,
        rawMaterialSnapshot: issue.rawMaterialSnapshot
      });
    }
  });
  
  store.auditLogs.forEach(log => {
    if (log.details?.traceId === traceId) {
      result.found = true;
      result.sources.push({
        type: 'audit_log',
        auditLogId: log.id,
        action: log.action,
        operator: log.operator,
        timestamp: log.timestamp,
        changeHistory: log.changeHistory
      });
    }
  });
  
  if (result.sources.length > 0) {
    const firstSource = result.sources[0];
    if (firstSource.ruleId) {
      const rule = getDesensitizationRuleById(firstSource.ruleId);
      if (rule) {
        result.relatedRule = {
          id: rule.id,
          name: rule.name,
          currentVersion: rule.currentVersion,
          versionHistory: rule.versionHistory
        };
      }
    }
    if (firstSource.batchId) {
      const batch = getGrayBatchById(firstSource.batchId);
      if (batch) {
        result.relatedBatch = {
          id: batch.id,
          batchNo: batch.batchNo,
          currentVersion: batch.currentVersion,
          versionHistory: batch.versionHistory
        };
      }
    }
  }
  
  return result;
}

function traceBackByRagReference(searchTerm) {
  const store = loadStore();
  const result = {
    searchTerm,
    matches: []
  };
  
  store.inspectionRecords.forEach(inspection => {
    inspection.gaps?.forEach(gap => {
      if (gap.type.includes('rag') && gap.ragMatchDetails) {
        gap.ragMatchDetails.forEach(match => {
          if (match.matchedText.includes(searchTerm) || 
              match.context?.fullContext?.includes(searchTerm)) {
            result.matches.push({
              inspectionId: inspection.id,
              inspectionDate: inspection.createdAt,
              ruleId: gap.ruleId,
              ruleName: gap.ruleName,
              batchNo: gap.batchNo,
              matchedText: match.matchedText,
              context: match.context,
              gapDescription: gap.description
            });
          }
        });
      }
      if (gap.rawMaterialSnapshot) {
        const snapshotText = JSON.stringify(gap.rawMaterialSnapshot);
        if (snapshotText.includes(searchTerm)) {
          result.matches.push({
            inspectionId: inspection.id,
            inspectionDate: inspection.createdAt,
            ruleId: gap.ruleId,
            ruleName: gap.ruleName,
            batchNo: gap.batchNo,
            gapType: gap.type,
            gapDescription: gap.description,
            foundIn: 'rawMaterialSnapshot',
            rawMaterialSnapshot: gap.rawMaterialSnapshot
          });
        }
      }
    });
  });
  
  return result;
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
  buildChangeHistory,
  importDesensitizationRule,
  updateDesensitizationRule,
  addGrayBatch,
  updateGrayBatch,
  getDesensitizationRules,
  getDesensitizationRuleById,
  getGrayBatches,
  getGrayBatchById,
  getAuditLogs,
  getInspectionRecords,
  getInspectionById,
  getExportResults,
  getPhoneMaskIssues,
  saveInspectionRecord,
  saveExportResult,
  savePhoneMaskIssue,
  updatePhoneMaskIssue,
  updateExportResult,
  traceBackByTraceId,
  traceBackByRagReference,
  clearAllData,
  generateId
};
