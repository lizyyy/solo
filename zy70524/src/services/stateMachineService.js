const { v4: uuidv4 } = require('uuid');
const { run, get } = require('../config/database');

const STATUS_TRANSITIONS = {
  detected: ['analyzing', 'dismissed'],
  analyzing: ['pending_disposition', 'dismissed'],
  pending_disposition: ['disposition_applied', 'review_required'],
  disposition_applied: ['review_required', 'resolved'],
  review_required: ['reviewing'],
  reviewing: ['resolved', 'dismissed'],
  resolved: [],
  dismissed: []
};

const DISPOSITION_ACTIONS = {
  alert_only: { name: '仅告警', description: '发送告警通知，不限制账号' },
  force_logout: { name: '强制下线', description: '强制当前会话下线' },
  password_reset: { name: '重置密码', description: '要求用户重置密码' },
  account_lock: { name: '账号锁定', description: '临时锁定账号' },
  mfa_required: { name: '要求MFA', description: '强制启用多因素认证' }
};

const REVIEW_RESULTS = {
  confirmed_risk: '确认风险',
  false_positive: '误报',
  need_more_info: '需补充信息',
  resolved_manually: '人工处置完成'
};

const canTransition = (currentStatus, nextStatus) => {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions && allowedTransitions.includes(nextStatus);
};

const recordHistory = async (eventId, fieldName, oldValue, newValue, operator, operatorType, changeReason) => {
  const now = Date.now();
  await run(
    `INSERT INTO event_history 
     (id, risk_event_id, field_name, old_value, new_value, operator, operator_type, change_reason, changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), eventId, fieldName, oldValue, newValue, operator, operatorType, changeReason, now]
  );
};

const transitionStatus = async (eventId, newStatus, operator, operatorType, reason) => {
  const event = await get('SELECT id, status FROM risk_events WHERE id = ?', [eventId]);
  
  if (!event) {
    throw new Error('风险事件不存在');
  }

  if (!canTransition(event.status, newStatus)) {
    throw new Error(`状态转换不允许: ${event.status} -> ${newStatus}`);
  }

  const oldStatus = event.status;
  const now = Date.now();

  await run(
    'UPDATE risk_events SET status = ?, updated_at = ? WHERE id = ?',
    [newStatus, now, eventId]
  );

  await recordHistory(
    eventId,
    'status',
    oldStatus,
    newStatus,
    operator,
    operatorType,
    reason || '状态流转'
  );

  return { success: true, oldStatus, newStatus };
};

const applyDisposition = async (eventId, actionType, operator, operatorType, reason) => {
  const event = await get('SELECT id, status, risk_level FROM risk_events WHERE id = ?', [eventId]);
  
  if (!event) {
    throw new Error('风险事件不存在');
  }

  if (!DISPOSITION_ACTIONS[actionType]) {
    throw new Error('未知的处置动作类型');
  }

  if (!['pending_disposition', 'reviewing'].includes(event.status)) {
    throw new Error('当前状态不允许执行处置动作');
  }

  const now = Date.now();
  const actionId = uuidv4();

  await run(
    `INSERT INTO disposition_actions 
     (id, risk_event_id, action_type, action_result, operator, operator_type, reason, executed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [actionId, eventId, actionType, 'success', operator, operatorType, reason, now, now]
  );

  await transitionStatus(
    eventId, 
    'disposition_applied', 
    operator, 
    operatorType, 
    `执行处置动作: ${DISPOSITION_ACTIONS[actionType].name}`
  );

  return { success: true, actionId, actionType };
};

const submitReview = async (eventId, reviewer, reviewResult, reviewComment, isFalsePositive = false) => {
  const event = await get('SELECT id, status FROM risk_events WHERE id = ?', [eventId]);
  
  if (!event) {
    throw new Error('风险事件不存在');
  }

  if (!REVIEW_RESULTS[reviewResult]) {
    throw new Error('未知的复核结果类型');
  }

  if (event.status !== 'reviewing') {
    throw new Error('当前状态不允许提交复核结论');
  }

  const now = Date.now();
  const reviewId = uuidv4();

  await run(
    `INSERT INTO review_conclusions 
     (id, risk_event_id, reviewer, review_result, review_comment, is_false_positive, reviewed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reviewId, eventId, reviewer, reviewResult, reviewComment, isFalsePositive ? 1 : 0, now, now, now]
  );

  const finalStatus = isFalsePositive ? 'dismissed' : 'resolved';
  const conclusion = isFalsePositive 
    ? `复核完成: 误报, ${REVIEW_RESULTS[reviewResult]}` 
    : `复核完成: ${REVIEW_RESULTS[reviewResult]}`;

  await run(
    'UPDATE risk_events SET final_conclusion = ?, updated_at = ? WHERE id = ?',
    [conclusion, now, eventId]
  );

  await transitionStatus(eventId, finalStatus, reviewer, 'human', reviewComment || '人工复核完成');

  return { success: true, reviewId, reviewResult, finalStatus };
};

module.exports = {
  STATUS_TRANSITIONS,
  DISPOSITION_ACTIONS,
  REVIEW_RESULTS,
  canTransition,
  transitionStatus,
  applyDisposition,
  submitReview,
  recordHistory
};
