const { STATUS_TRANSITIONS, ACTIONS, CHANGE_STATUSES } = require('../constants/statuses');
const { runAsync, getAsync } = require('../db');
const { v4: uuidv4 } = require('uuid');

class StateMachineError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'StateMachineError';
  }
}

function canPerformAction(currentStatus, action) {
  const stateConfig = STATUS_TRANSITIONS[currentStatus];
  if (!stateConfig) {
    return { allowed: false, reason: `无效的状态: ${currentStatus}` };
  }
  if (!stateConfig.allowedActions.includes(action)) {
    return { 
      allowed: false, 
      reason: `状态 [${currentStatus}] 不允许执行动作 [${action}]，允许的动作: ${stateConfig.allowedActions.join(', ')}` 
    };
  }
  return { allowed: true };
}

function getNextStatus(currentStatus, action) {
  const actionToStatusMap = {
    [ACTIONS.APPROVE]: CHANGE_STATUSES.APPROVED,
    [ACTIONS.REJECT]: CHANGE_STATUSES.REJECTED,
    [ACTIONS.START_EXECUTE]: CHANGE_STATUSES.EXECUTING,
    [ACTIONS.COMPLETE]: CHANGE_STATUSES.COMPLETED,
    [ACTIONS.CANCEL]: CHANGE_STATUSES.CANCELLED,
    [ACTIONS.MARK_ABNORMAL]: CHANGE_STATUSES.ABNORMAL,
    [ACTIONS.RESOLVE_ABNORMAL]: CHANGE_STATUSES.PENDING_REVIEW,
    [ACTIONS.SUBMIT]: CHANGE_STATUSES.PENDING_REVIEW
  };

  const nextStatus = actionToStatusMap[action];
  const stateConfig = STATUS_TRANSITIONS[currentStatus];
  
  if (!stateConfig.nextStatuses.includes(nextStatus)) {
    throw new StateMachineError(
      `状态 [${currentStatus}] 无法通过动作 [${action}] 转换，目标状态 [${nextStatus}] 不在允许列表中`,
      'INVALID_TRANSITION'
    );
  }

  return nextStatus;
}

async function transitionStatus(changeId, action, operator, comment = null) {
  const change = await getAsync('SELECT * FROM feeding_changes WHERE id = ?', [changeId]);
  if (!change) {
    throw new StateMachineError(`未找到变更记录: ${changeId}`, 'CHANGE_NOT_FOUND');
  }

  const currentStatus = change.status;
  const checkResult = canPerformAction(currentStatus, action);
  
  if (!checkResult.allowed) {
    throw new StateMachineError(checkResult.reason, 'ACTION_NOT_ALLOWED');
  }

  const nextStatus = getNextStatus(currentStatus, action);
  const now = new Date().toISOString();

  await runAsync('BEGIN TRANSACTION');

  try {
    await runAsync(`
      UPDATE feeding_changes 
      SET status = ?, updated_at = ?,
          reviewed_by = CASE WHEN ? IN ('approve', 'reject') THEN ? ELSE reviewed_by END,
          reviewed_at = CASE WHEN ? IN ('approve', 'reject') THEN ? ELSE reviewed_at END,
          review_comment = CASE WHEN ? IN ('approve', 'reject') THEN ? ELSE review_comment END
      WHERE id = ?
    `, [
      nextStatus, now,
      action, operator,
      action, now,
      action, comment,
      changeId
    ]);

    const logId = uuidv4();
    await runAsync(`
      INSERT INTO change_status_logs (id, feeding_change_id, from_status, to_status, action, operator, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [logId, changeId, currentStatus, nextStatus, action, operator, comment, now]);

    await runAsync('COMMIT');

    return {
      success: true,
      changeId,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      action,
      operator,
      timestamp: now
    };
  } catch (error) {
    await runAsync('ROLLBACK');
    throw error;
  }
}

function getAllValidTransitions() {
  return Object.entries(STATUS_TRANSITIONS).map(([status, config]) => ({
    currentStatus: status,
    allowedActions: config.allowedActions,
    nextStatuses: config.nextStatuses
  }));
}

module.exports = {
  StateMachineError,
  canPerformAction,
  getNextStatus,
  transitionStatus,
  getAllValidTransitions
};
