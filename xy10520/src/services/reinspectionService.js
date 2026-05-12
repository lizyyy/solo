const { 
  getAllReinspections, saveReinspections,
  getIssueById, addLog,
  getLatestCorrection
} = require('../storage');
const { generateId, validateRequired, formatDate } = require('../utils');
const { STATUS, readConfig } = require('../config');
const { updateIssueStatus } = require('./inspectionService');

function submitReinspection(reinspection, operator = 'system') {
  const results = { success: null, failed: null };
  
  const missing = validateRequired(reinspection, ['issueId', 'inspector', 'result']);
  if (missing.length > 0) {
    results.failed = {
      input: reinspection,
      reason: `缺少必填字段: ${missing.join(', ')}`
    };
    return results;
  }
  
  if (!['通过', '不通过'].includes(reinspection.result)) {
    results.failed = {
      input: reinspection,
      reason: '复查结果必须是"通过"或"不通过"'
    };
    return results;
  }
  
  const issue = getIssueById(reinspection.issueId);
  if (!issue) {
    results.failed = {
      input: reinspection,
      reason: `问题不存在: ${reinspection.issueId}`
    };
    return results;
  }
  
  const latestCorrection = getLatestCorrection(reinspection.issueId);
  if (!latestCorrection) {
    results.failed = {
      input: reinspection,
      reason: '该问题尚未提交整改，无法进行复查'
    };
    return results;
  }
  
  const reinspections = getAllReinspections();
  
  const existing = reinspections.find(r => 
    r.issueId === reinspection.issueId &&
    r.inspector === reinspection.inspector &&
    r.result === reinspection.result &&
    r.comment === reinspection.comment
  );
  
  if (existing) {
    return {
      success: existing,
      skipped: true,
      reason: '相同的复查记录已存在'
    };
  }
  
  const config = readConfig();
  
  const newReinspection = {
    id: generateId('reinspect'),
    issueId: reinspection.issueId,
    correctionId: latestCorrection.id,
    inspector: reinspection.inspector,
    result: reinspection.result,
    comment: reinspection.comment || '',
    photoUrls: reinspection.photoUrls || [],
    reinspectedAt: new Date().toISOString(),
    penaltyPoints: reinspection.result === '不通过' ? config.reinspectionFailPenalty : 0
  };
  
  reinspections.push(newReinspection);
  saveReinspections(reinspections);
  
  let newStatus;
  if (reinspection.result === '通过') {
    newStatus = STATUS.CLOSED;
  } else {
    newStatus = STATUS.FAILED;
  }
  
  const statusUpdate = updateIssueStatus(
    reinspection.issueId, 
    newStatus, 
    operator,
    { latestReinspectionId: newReinspection.id }
  );
  
  const penaltyInfo = reinspection.result === '不通过' 
    ? `, 扣 ${config.reinspectionFailPenalty} 分` 
    : '';
  
  addLog({
    action: 'SUBMIT_REINSPECTION',
    operator,
    targetId: newReinspection.id,
    before: null,
    after: newReinspection,
    details: `提交复查: 问题 ${reinspection.issueId}, 结果 ${reinspection.result}${penaltyInfo}`
  });
  
  results.success = newReinspection;
  return results;
}

module.exports = {
  submitReinspection,
  getAllReinspections
};
