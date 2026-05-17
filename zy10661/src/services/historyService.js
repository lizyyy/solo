const { run, get, all, generateId, now } = require('../db');

const HISTORY_ACTIONS = {
  NOTICE_CREATED: 'NOTICE_CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  MATERIAL_UPDATED: 'MATERIAL_UPDATED',
  REMINDER_SENT: 'REMINDER_SENT',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  CONFLICT_RESOLVED: 'CONFLICT_RESOLVED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED'
};

function logHistory(data) {
  const id = generateId();
  run(`
    INSERT INTO history_logs (
      id, claim_id, notice_id, material_id, action,
      from_status, to_status, operator_id, operator_name,
      remark, flow_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.claim_id,
    data.notice_id || null,
    data.material_id || null,
    data.action,
    data.from_status || null,
    data.to_status || null,
    data.operator_id || null,
    data.operator_name || null,
    data.remark || null,
    data.flow_type || null,
    now()
  ]);
  return id;
}

function getHistoryByClaimId(claimId) {
  return all(`
    SELECT * FROM history_logs
    WHERE claim_id = ?
    ORDER BY created_at DESC
  `, [claimId]);
}

function getHistoryByNoticeId(noticeId) {
  return all(`
    SELECT * FROM history_logs
    WHERE notice_id = ?
    ORDER BY created_at DESC
  `, [noticeId]);
}

function getFullHistoryTimeline(claimId) {
  return all(`
    SELECT 
      hl.*,
      nr.flow_type as notice_flow_type,
      nr.channel as notice_channel
    FROM history_logs hl
    LEFT JOIN notice_records nr ON hl.notice_id = nr.id
    WHERE hl.claim_id = ?
    ORDER BY hl.created_at ASC
  `, [claimId]);
}

module.exports = {
  HISTORY_ACTIONS,
  logHistory,
  getHistoryByClaimId,
  getHistoryByNoticeId,
  getFullHistoryTimeline
};
