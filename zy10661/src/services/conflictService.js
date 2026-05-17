const { run, get, all, generateId, now } = require('../db');
const { HISTORY_ACTIONS, logHistory } = require('./historyService');

const CONFLICT_TYPES = {
  DUPLICATE_REMINDER_AFTER_COMPLETED: 'DUPLICATE_REMINDER_AFTER_COMPLETED',
  MATERIAL_COMPLETED_BUT_NOTICE_PENDING: 'MATERIAL_COMPLETED_BUT_NOTICE_PENDING',
  DEADLINE_PASSED_NO_REMINDER: 'DEADLINE_PASSED_NO_REMINDER'
};

const CONFLICT_STATUS = {
  DETECTED: 'DETECTED',
  PROCESSING: 'PROCESSING',
  RESOLVED: 'RESOLVED'
};

function detectConflicts(noticeId) {
  const notice = get('SELECT * FROM notice_records WHERE id = ?', [noticeId]);
  if (!notice) return [];

  const conflicts = [];

  if (notice.status === 'COMPLETED') {
    const recentReminders = all(`
      SELECT * FROM history_logs
      WHERE notice_id = ? AND action = ? AND created_at > ?
    `, [noticeId, HISTORY_ACTIONS.REMINDER_SENT, notice.updated_at]);

    if (recentReminders.length > 0) {
      conflicts.push({
        type: CONFLICT_TYPES.DUPLICATE_REMINDER_AFTER_COMPLETED,
        description: `材料已补齐但仍发送了 ${recentReminders.length} 次催办通知`,
        noticeId,
        claimId: notice.claim_id
      });
    }
  }

  return conflicts;
}

function recordConflict(data) {
  const id = generateId();
  run(`
    INSERT INTO conflict_records (
      id, claim_id, notice_id, conflict_type, detected_at,
      detected_by, description, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.claimId,
    data.noticeId,
    data.type,
    now(),
    data.detectedBy || 'system',
    data.description,
    CONFLICT_STATUS.DETECTED
  ]);

  logHistory({
    claim_id: data.claimId,
    notice_id: data.noticeId,
    action: HISTORY_ACTIONS.CONFLICT_DETECTED,
    remark: `检测到冲突: ${data.description}`,
    operator_id: data.detectedBy || 'system',
    operator_name: data.detectedBy ? '操作员' : '系统'
  });

  return id;
}

function resolveConflict(conflictId, resolution, resolvedBy) {
  const conflict = get('SELECT * FROM conflict_records WHERE id = ?', [conflictId]);
  if (!conflict) throw new Error('冲突记录不存在');

  run(`
    UPDATE conflict_records
    SET status = ?, resolved_at = ?, resolved_by = ?, resolution = ?
    WHERE id = ?
  `, [CONFLICT_STATUS.RESOLVED, now(), resolvedBy, resolution, conflictId]);

  logHistory({
    claim_id: conflict.claim_id,
    notice_id: conflict.notice_id,
    action: HISTORY_ACTIONS.CONFLICT_RESOLVED,
    remark: `冲突已解决: ${resolution}`,
    operator_id: resolvedBy,
    operator_name: '操作员'
  });

  return getConflictById(conflictId);
}

function getConflictById(conflictId) {
  return get('SELECT * FROM conflict_records WHERE id = ?', [conflictId]);
}

function getConflictsByClaimId(claimId) {
  return all(`
    SELECT * FROM conflict_records
    WHERE claim_id = ?
    ORDER BY detected_at DESC
  `, [claimId]);
}

function getAllConflicts(status = null) {
  let sql = 'SELECT * FROM conflict_records';
  const params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY detected_at DESC';
  return all(sql, params);
}

module.exports = {
  CONFLICT_TYPES,
  CONFLICT_STATUS,
  detectConflicts,
  recordConflict,
  resolveConflict,
  getConflictById,
  getConflictsByClaimId,
  getAllConflicts
};
