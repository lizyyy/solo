const { runQuery, getQuery, allQuery } = require('../models/database');
const { validateStatusTransition } = require('./businessRuleService');

async function processClaim(claimId, action, handler, reason = '') {
  const claim = await getQuery('SELECT * FROM claims WHERE id = ?', [claimId]);
  if (!claim) {
    throw new Error('申诉记录不存在');
  }

  const actionMap = {
    approve: 'approved',
    reject: 'rejected',
    return: 'returned',
    review: 'pending_review'
  };

  const newStatus = actionMap[action];
  if (!newStatus) {
    throw new Error('无效的处理操作');
  }

  if (!validateStatusTransition(claim.status, newStatus)) {
    throw new Error(`无法从${claim.status}状态变更为${newStatus}`);
  }

  await runQuery(
    `UPDATE claims SET status = ?, status_reason = ?, handler = ?, 
     handled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [newStatus, reason, handler, claimId]
  );

  await addProcessingLog(claimId, action, reason, handler, claim.status, newStatus);
  await updateBatchProcessedCount(claim.batch_id);

  return getQuery('SELECT * FROM claims WHERE id = ?', [claimId]);
}

async function addProcessingLog(claimId, action, reason, handler, oldStatus, newStatus) {
  return runQuery(
    `INSERT INTO processing_logs (claim_id, action, reason, handler, old_status, new_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [claimId, action, reason, handler, oldStatus, newStatus]
  );
}

async function updateBatchProcessedCount(batchId) {
  const result = await getQuery(
    `SELECT COUNT(*) as count FROM claims 
     WHERE batch_id = ? AND status NOT IN ('pending', 'pending_review')`,
    [batchId]
  );
  
  await runQuery(
    'UPDATE batches SET processed_claims = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [result.count, batchId]
  );
}

async function getClaimLogs(claimId) {
  return allQuery(
    `SELECT * FROM processing_logs WHERE claim_id = ? ORDER BY created_at DESC`,
    [claimId]
  );
}

async function batchProcess(claimIds, action, handler, reason = '') {
  const results = [];
  for (const claimId of claimIds) {
    try {
      const result = await processClaim(claimId, action, handler, reason);
      results.push({ claimId, success: true, result });
    } catch (err) {
      results.push({ claimId, success: false, error: err.message });
    }
  }
  return results;
}

module.exports = {
  processClaim,
  batchProcess,
  getClaimLogs,
  addProcessingLog
};
