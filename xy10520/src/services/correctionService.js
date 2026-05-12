const { 
  getAllCorrections, saveCorrections,
  getIssueById, addLog,
  getCorrectionsByIssue
} = require('../storage');
const { generateId, validateRequired, formatDate } = require('../utils');
const { STATUS } = require('../config');
const { updateIssueStatus } = require('./inspectionService');

function submitCorrection(correction, operator = 'system') {
  const results = { success: null, failed: null };
  
  const missing = validateRequired(correction, ['issueId', 'submittedBy']);
  if (missing.length > 0) {
    results.failed = {
      input: correction,
      reason: `缺少必填字段: ${missing.join(', ')}`
    };
    return results;
  }
  
  const issue = getIssueById(correction.issueId);
  if (!issue) {
    results.failed = {
      input: correction,
      reason: `问题不存在: ${correction.issueId}`
    };
    return results;
  }
  
  if (!correction.photoUrls || correction.photoUrls.length === 0) {
    results.failed = {
      input: correction,
      reason: '整改照片缺失，至少需要1张整改照片'
    };
    return results;
  }
  
  const corrections = getAllCorrections();
  
  const existing = corrections.find(c => 
    c.issueId === correction.issueId &&
    c.submittedBy === correction.submittedBy &&
    c.description === correction.description
  );
  
  if (existing) {
    return {
      success: existing,
      skipped: true,
      reason: '相同的整改提交已存在'
    };
  }
  
  const newCorrection = {
    id: generateId('corr'),
    issueId: correction.issueId,
    description: correction.description || '',
    photoUrls: correction.photoUrls,
    submittedBy: correction.submittedBy,
    submittedAt: new Date().toISOString(),
    remark: correction.remark || ''
  };
  
  corrections.push(newCorrection);
  saveCorrections(corrections);
  
  const statusUpdate = updateIssueStatus(
    correction.issueId, 
    STATUS.SUBMITTED, 
    operator,
    { latestCorrectionId: newCorrection.id }
  );
  
  addLog({
    action: 'SUBMIT_CORRECTION',
    operator,
    targetId: newCorrection.id,
    before: null,
    after: newCorrection,
    details: `提交整改: 问题 ${correction.issueId}, 提交人 ${correction.submittedBy}, 照片数量 ${correction.photoUrls.length}`
  });
  
  results.success = newCorrection;
  return results;
}

module.exports = {
  submitCorrection,
  getAllCorrections,
  getCorrectionsByIssue
};
