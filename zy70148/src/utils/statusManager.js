const db = require('../db/connection');
const config = require('../config');
const { generateUUID, getTimestamp } = require('./ticketGenerator');

const STATUS_TRANSITIONS = {
  [config.status.DRAFT]: [config.status.PENDING_REVIEW, config.status.CANCELLED],
  [config.status.PENDING_REVIEW]: [config.status.REVIEW_APPROVED, config.status.REVIEW_REJECTED, config.status.CANCELLED],
  [config.status.REVIEW_REJECTED]: [config.status.DRAFT, config.status.CANCELLED],
  [config.status.REVIEW_APPROVED]: [config.status.EXECUTING, config.status.CANCELLED],
  [config.status.EXECUTING]: [config.status.EXECUTION_SUCCESS, config.status.EXECUTION_FAILED],
  [config.status.EXECUTION_FAILED]: [config.status.DRAFT, config.status.CANCELLED],
  [config.status.EXECUTION_SUCCESS]: [config.status.ROLLBACK_REQUESTED, config.status.CLOSED],
  [config.status.ROLLBACK_REQUESTED]: [config.status.ROLLBACK_EXECUTING, config.status.CANCELLED],
  [config.status.ROLLBACK_EXECUTING]: [config.status.ROLLBACK_SUCCESS, config.status.ROLLBACK_FAILED],
  [config.status.ROLLBACK_FAILED]: [config.status.ROLLBACK_REQUESTED, config.status.CLOSED],
  [config.status.ROLLBACK_SUCCESS]: [config.status.CLOSED, config.status.CANCELLED],
  [config.status.CANCELLED]: [],
  [config.status.CLOSED]: []
};

function isValidTransition(fromStatus, toStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
}

async function updateStatus(requestId, newStatus, operator, reason = null, isManualCorrection = false) {
  const timestamp = getTimestamp();
  
  const currentRequest = await db.get(
    'SELECT current_status FROM repair_requests WHERE id = ?',
    [requestId]
  );
  
  if (!currentRequest) {
    throw new Error(`Request not found: ${requestId}`);
  }
  
  const oldStatus = currentRequest.current_status;
  
  if (!isManualCorrection && !isValidTransition(oldStatus, newStatus)) {
    throw new Error(`Invalid status transition: ${oldStatus} -> ${newStatus}`);
  }
  
  const queries = [
    {
      sql: 'INSERT INTO status_history (id, request_id, old_status, new_status, operator_id, operator_name, reason, is_manual_correction, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [
        generateUUID(),
        requestId,
        oldStatus,
        newStatus,
        operator.id,
        operator.name,
        reason,
        isManualCorrection ? 1 : 0,
        timestamp
      ]
    },
    {
      sql: 'UPDATE repair_requests SET current_status = ?, updated_at = ? WHERE id = ?',
      params: [newStatus, timestamp, requestId]
    }
  ];
  
  await db.runTransaction(queries);
  
  return {
    requestId,
    oldStatus,
    newStatus,
    isManualCorrection,
    timestamp
  };
}

async function getStatusHistory(requestId) {
  return db.all(
    `SELECT id, old_status, new_status, operator_id, operator_name, reason, 
            is_manual_correction, created_at 
     FROM status_history 
     WHERE request_id = ? 
     ORDER BY created_at ASC`,
    [requestId]
  );
}

async function getStatusAtTime(requestId, targetTime) {
  const history = await db.all(
    `SELECT new_status, created_at 
     FROM status_history 
     WHERE request_id = ? AND created_at <= ? 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [requestId, targetTime]
  );
  
  if (history.length === 0) {
    const request = await db.get(
      'SELECT current_status, created_at FROM repair_requests WHERE id = ?',
      [requestId]
    );
    return request ? request.current_status : null;
  }
  
  return history[0].new_status;
}

module.exports = {
  isValidTransition,
  updateStatus,
  getStatusHistory,
  getStatusAtTime,
  STATUS_TRANSITIONS
};