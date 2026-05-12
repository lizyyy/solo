const { 
  getAllInspections, saveInspections, 
  getAllIssues, saveIssues,
  addLog, getInspectionById, getStoreById,
  getIssuesByInspection
} = require('../storage');
const { generateId, validateRequired, addDays, formatDate } = require('../utils');
const { ISSUE_CATEGORIES, STATUS, readConfig } = require('../config');

function importInspections(inspections, operator = 'system') {
  const results = { success: [], failed: [], skipped: [] };
  const existingInspections = getAllInspections();
  const existingIds = new Set(existingInspections.map(i => i.id));
  
  const config = readConfig();
  
  for (const input of inspections) {
    const missing = validateRequired(input, ['storeId', 'inspectionDate', 'inspector']);
    if (missing.length > 0) {
      results.failed.push({
        input,
        reason: `缺少必填字段: ${missing.join(', ')}`
      });
      continue;
    }
    
    if (!getStoreById(input.storeId)) {
      results.failed.push({
        input,
        reason: `门店不存在: ${input.storeId}`
      });
      continue;
    }
    
    if (input.id && existingIds.has(input.id)) {
      results.skipped.push({
        input,
        reason: '巡店记录ID已存在'
      });
      continue;
    }
    
    const inspection = {
      id: input.id || generateId('inspect'),
      storeId: input.storeId,
      inspectionDate: input.inspectionDate,
      inspector: input.inspector,
      remark: input.remark || '',
      createdAt: new Date().toISOString(),
      importedBy: operator
    };
    
    existingInspections.push(inspection);
    if (inspection.id) existingIds.add(inspection.id);
    
    addLog({
      action: 'IMPORT_INSPECTION',
      operator,
      targetId: inspection.id,
      before: null,
      after: inspection,
      details: `导入巡店记录: 门店 ${input.storeId}, 日期 ${input.inspectionDate}`
    });
    
    results.success.push(inspection);
  }
  
  saveInspections(existingInspections);
  return results;
}

function importIssues(issues, operator = 'system') {
  const results = { success: [], failed: [], skipped: [] };
  const existingIssues = getAllIssues();
  const existingIds = new Set(existingIssues.map(i => i.id));
  
  const config = readConfig();
  
  for (const input of issues) {
    const missing = validateRequired(input, ['inspectionId', 'category', 'description']);
    if (missing.length > 0) {
      results.failed.push({
        input,
        reason: `缺少必填字段: ${missing.join(', ')}`
      });
      continue;
    }
    
    if (!ISSUE_CATEGORIES.includes(input.category)) {
      results.failed.push({
        input,
        reason: `问题类别无效，必须是: ${ISSUE_CATEGORIES.join(', ')}`
      });
      continue;
    }
    
    const inspection = getInspectionById(input.inspectionId);
    if (!inspection) {
      results.failed.push({
        input,
        reason: `巡店记录不存在: ${input.inspectionId}`
      });
      continue;
    }
    
    const issueId = input.id || generateId('issue');
    
    if (input.id && existingIds.has(input.id)) {
      results.skipped.push({
        input,
        reason: '问题ID已存在'
      });
      continue;
    }
    
    const issueKey = `${input.inspectionId}_${input.category}_${input.description}`;
    const existing = existingIssues.find(i => 
      `${i.inspectionId}_${i.category}_${i.description}` === issueKey
    );
    
    if (existing) {
      results.skipped.push({
        input,
        reason: `同一次巡店中相同问题已存在: ${existing.id}`
      });
      continue;
    }
    
    const dueDays = input.dueDays || config.defaultCorrectionDays;
    const inspectionDate = new Date(inspection.inspectionDate);
    const dueDate = addDays(inspectionDate, dueDays);
    
    const issue = {
      id: issueId,
      inspectionId: input.inspectionId,
      storeId: inspection.storeId,
      category: input.category,
      description: input.description,
      severity: input.severity || '普通',
      status: STATUS.PENDING,
      dueDate: dueDate.toISOString(),
      photoUrls: input.photoUrls || [],
      remark: input.remark || '',
      createdAt: new Date().toISOString(),
      importedBy: operator
    };
    
    existingIssues.push(issue);
    existingIds.add(issue.id);
    
    addLog({
      action: 'IMPORT_ISSUE',
      operator,
      targetId: issue.id,
      before: null,
      after: issue,
      details: `导入问题: ${issue.category} - ${issue.description}, 截止日期 ${formatDate(dueDate)}`
    });
    
    results.success.push(issue);
  }
  
  saveIssues(existingIssues);
  return results;
}

function updateIssueStatus(issueId, status, operator = 'system', extra = {}) {
  const issues = getAllIssues();
  const index = issues.findIndex(i => i.id === issueId);
  
  if (index === -1) {
    return { success: false, reason: '问题不存在' };
  }
  
  const before = { ...issues[index] };
  const after = { 
    ...issues[index], 
    status, 
    updatedAt: new Date().toISOString(),
    ...extra
  };
  
  issues[index] = after;
  saveIssues(issues);
  
  addLog({
    action: 'UPDATE_ISSUE_STATUS',
    operator,
    targetId: issueId,
    before,
    after,
    details: `更新问题状态: ${before.status} -> ${status}`
  });
  
  return { success: true, issue: after };
}

module.exports = {
  importInspections,
  importIssues,
  updateIssueStatus,
  getAllInspections,
  getInspectionById,
  getAllIssues,
  getIssuesByInspection
};
