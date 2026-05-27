const { run, get, all } = require('../database');

async function logAudit(recordId, batchId, modifiedBy, fieldName, oldValue, newValue, changeReason) {
  await run(
    `INSERT INTO audit_logs (record_id, batch_id, modified_by, field_name, old_value, new_value, change_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [recordId, batchId, modifiedBy, fieldName, String(oldValue || ''), String(newValue || ''), changeReason]
  );
}

async function getRecordById(recordId) {
  return get('SELECT * FROM maintenance_records WHERE id = ?', [recordId]);
}

async function updateFieldWithAudit(recordId, batchId, modifiedBy, fieldName, newValue, changeReason) {
  const record = await getRecordById(recordId);
  if (!record) throw new Error('记录不存在');

  const oldValue = record[fieldName];
  if (oldValue === newValue) return record;

  await run(`UPDATE maintenance_records SET ${fieldName} = ? WHERE id = ?`, [newValue, recordId]);
  
  await logAudit(recordId, batchId, modifiedBy, fieldName, oldValue, newValue, changeReason);
  
  return getRecordById(recordId);
}

async function submitAppeal(recordId, batchId, modifiedBy, appealScore, appealReason) {
  await updateFieldWithAudit(recordId, batchId, modifiedBy, 'appeal_score', appealScore, '学生申诉改分');
  return updateFieldWithAudit(recordId, batchId, modifiedBy, 'appeal_reason', appealReason, '学生申诉原因');
}

async function reviewScore(recordId, batchId, modifiedBy, reviewScore, reviewReason, isMaliciousLowScore = false, maliciousReason = '') {
  if (isMaliciousLowScore && !maliciousReason) {
    throw new Error('标记为恶意低分时必须提供复核理由');
  }

  let record = await updateFieldWithAudit(recordId, batchId, modifiedBy, 'review_score', reviewScore, '后勤复核评分');
  record = await updateFieldWithAudit(recordId, batchId, modifiedBy, 'review_reason', reviewReason, '后勤复核原因');
  
  if (isMaliciousLowScore) {
    record = await updateFieldWithAudit(recordId, batchId, modifiedBy, 'is_malicious_low_score', 1, '标记为恶意低分');
    record = await updateFieldWithAudit(recordId, batchId, modifiedBy, 'malicious_reason', maliciousReason, '恶意低分理由');
  }
  
  record = await updateFieldWithAudit(recordId, batchId, modifiedBy, 'final_score', reviewScore, '复核后最终分数');
  
  return record;
}

async function getRecordAuditLogs(recordId) {
  return all(
    `SELECT * FROM audit_logs 
     WHERE record_id = ? 
     ORDER BY modified_at DESC`,
    [recordId]
  );
}

async function getBatchAuditLogs(batchId) {
  return all(
    `SELECT * FROM audit_logs 
     WHERE batch_id = ? 
     ORDER BY modified_at DESC`,
    [batchId]
  );
}

async function updateFinalScore(recordId, batchId, modifiedBy, finalScore, changeReason) {
  return updateFieldWithAudit(recordId, batchId, modifiedBy, 'final_score', finalScore, changeReason);
}

module.exports = {
  getRecordById,
  submitAppeal,
  reviewScore,
  getRecordAuditLogs,
  getBatchAuditLogs,
  updateFinalScore
};
