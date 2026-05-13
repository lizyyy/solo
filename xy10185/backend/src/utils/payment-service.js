const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { queryAll, queryOne, runQuery } = require('./db');

const PAYMENT_TRIGGER_TYPES = {
  ALL_ACCEPTED: 'all_accepted',
  NO_REWORK_PENDING: 'no_rework_pending',
  PERCENTAGE_ACCEPTED: 'percentage_accepted',
  SPECIFIC_DELIVERABLES: 'specific_deliverables',
  MANUAL: 'manual'
};

const PAYMENT_ACTIONS = {
  TRIGGER_MET: 'trigger_met',
  TRIGGER_NOT_MET: 'trigger_not_met',
  APPROVED: 'approved',
  PAID: 'paid',
  REJECTED: 'rejected',
  RESET: 'reset'
};

function getMilestonePaymentStatus(milestoneId) {
  const deliverables = queryAll(
    'SELECT * FROM deliverables WHERE milestone_id = ?',
    [milestoneId]
  );
  
  const acceptanceRecords = queryAll(`
    SELECT ar.* FROM acceptance_records ar
    JOIN deliverables d ON ar.deliverable_id = d.id
    WHERE d.milestone_id = ?
  `, [milestoneId]);
  
  const reworkRecords = queryAll(`
    SELECT r.* FROM rework_records r
    JOIN deliverables d ON r.deliverable_id = d.id
    WHERE d.milestone_id = ?
  `, [milestoneId]);
  
  const acceptedCount = deliverables.filter(d => d.status === 'accepted').length;
  const pendingReworkCount = reworkRecords.filter(r => r.status === 'pending').length;
  const totalDeliverables = deliverables.length;
  
  return {
    total_deliverables: totalDeliverables,
    accepted_count: acceptedCount,
    rejected_count: deliverables.filter(d => d.status === 'rejected').length,
    submitted_count: deliverables.filter(d => d.status === 'submitted').length,
    pending_rework_count: pendingReworkCount,
    completed_rework_count: reworkRecords.filter(r => r.status === 'completed').length,
    acceptance_rate: totalDeliverables > 0 ? (acceptedCount / totalDeliverables) * 100 : 0
  };
}

function checkPaymentTrigger(milestone) {
  const status = getMilestonePaymentStatus(milestone.id);
  
  const triggerType = milestone.payment_trigger_type || 'all_accepted';
  const condition = milestone.payment_trigger_condition ? JSON.parse(milestone.payment_trigger_condition) : {};
  
  let triggerMet = false;
  let details = '';
  
  switch (triggerType) {
    case PAYMENT_TRIGGER_TYPES.ALL_ACCEPTED:
      triggerMet = status.total_deliverables > 0 && 
                   status.accepted_count === status.total_deliverables && 
                   status.pending_rework_count === 0;
      details = triggerMet 
        ? '所有交付物已验收通过，且无待处理返工'
        : `验收通过: ${status.accepted_count}/${status.total_deliverables}, 待返工: ${status.pending_rework_count}`;
      break;
      
    case PAYMENT_TRIGGER_TYPES.NO_REWORK_PENDING:
      triggerMet = status.pending_rework_count === 0;
      details = triggerMet 
        ? '无待处理的返工任务'
        : `仍有 ${status.pending_rework_count} 个返工任务待完成`;
      break;
      
    case PAYMENT_TRIGGER_TYPES.PERCENTAGE_ACCEPTED:
      const requiredPercentage = condition.percentage || 100;
      const currentPercentage = status.acceptance_rate;
      triggerMet = currentPercentage >= requiredPercentage;
      details = triggerMet
        ? `验收通过率 ${currentPercentage.toFixed(1)}% >= ${requiredPercentage}%`
        : `验收通过率 ${currentPercentage.toFixed(1)}% < ${requiredPercentage}%`;
      break;
      
    case PAYMENT_TRIGGER_TYPES.SPECIFIC_DELIVERABLES:
      const requiredIds = condition.deliverable_ids || [];
      const requiredDeliverables = queryAll(
        'SELECT * FROM deliverables WHERE id IN (' + requiredIds.map(() => '?').join(',') + ')',
        requiredIds
      );
      const allRequiredAccepted = requiredDeliverables.every(d => d.status === 'accepted');
      triggerMet = allRequiredAccepted;
      details = triggerMet
        ? '指定的交付物已全部验收通过'
        : '存在未验收通过的指定交付物';
      break;
      
    case PAYMENT_TRIGGER_TYPES.MANUAL:
      triggerMet = milestone.payment_approved === 1;
      details = triggerMet ? '已手动审批通过' : '等待手动审批';
      break;
      
    default:
      triggerMet = false;
      details = '未知的付款触发类型';
  }
  
  return {
    trigger_met: triggerMet,
    trigger_type: triggerType,
    status,
    details
  };
}

function recordPaymentTriggerLog(milestoneId, triggerType, triggerSource, sourceId, details) {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const id = uuidv4();
  
  runQuery(
    `INSERT INTO payment_trigger_logs (id, milestone_id, trigger_type, trigger_source, source_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, milestoneId, triggerType, triggerSource, sourceId || null, JSON.stringify(details), now]
  );
  
  return id;
}

function recordPaymentHistory(milestoneId, amount, action, operator, reason, beforeStatus, afterStatus) {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const id = uuidv4();
  
  runQuery(
    `INSERT INTO payment_history (id, milestone_id, amount, action, operator, reason, before_status, after_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, milestoneId, amount, action, operator || '', reason || '', beforeStatus || '', afterStatus || '', now]
  );
  
  return id;
}

function checkAndUpdatePaymentStatus(milestoneId, triggerSource, sourceId) {
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
  if (!milestone) return null;
  
  const result = checkPaymentTrigger(milestone);
  
  recordPaymentTriggerLog(
    milestoneId,
    result.trigger_type,
    triggerSource,
    sourceId,
    result
  );
  
  if (result.trigger_met && milestone.payment_status === 'unpaid') {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    runQuery(
      `UPDATE milestones SET payment_status = ?, updated_at = ? WHERE id = ?`,
      ['partial', now, milestoneId]
    );
    
    recordPaymentHistory(
      milestoneId,
      milestone.payment_amount || 0,
      PAYMENT_ACTIONS.TRIGGER_MET,
      'system',
      result.details,
      'unpaid',
      'partial'
    );
    
    return {
      updated: true,
      milestoneId,
      old_status: 'unpaid',
      new_status: 'partial',
      details: result.details
    };
  }
  
  return {
    updated: false,
    milestoneId,
    details: result.details
  };
}

function approvePayment(milestoneId, operator, reason) {
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
  if (!milestone) return null;
  
  if (milestone.payment_status === 'paid') {
    return { success: false, message: '该里程碑已付款' };
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const beforeStatus = milestone.payment_status;
  
  runQuery(
    `UPDATE milestones SET 
      payment_approved = 1, 
      payment_approved_by = ?, 
      payment_approved_at = ?,
      payment_status = ?,
      updated_at = ? 
     WHERE id = ?`,
    [operator || '', now, 'partial', now, milestoneId]
  );
  
  recordPaymentHistory(
    milestoneId,
    milestone.payment_amount || 0,
    PAYMENT_ACTIONS.APPROVED,
    operator,
    reason || '',
    beforeStatus,
    'partial'
  );
  
  return { success: true, milestoneId, message: '付款已审批通过' };
}

function confirmPayment(milestoneId, operator, reason) {
  const milestone = queryOne('SELECT * FROM milestones WHERE id = ?', [milestoneId]);
  if (!milestone) return null;
  
  if (milestone.payment_status === 'paid') {
    return { success: false, message: '该里程碑已付款' };
  }
  
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const beforeStatus = milestone.payment_status;
  
  runQuery(
    `UPDATE milestones SET payment_status = ?, updated_at = ? WHERE id = ?`,
    ['paid', now, milestoneId]
  );
  
  recordPaymentHistory(
    milestoneId,
    milestone.payment_amount || 0,
    PAYMENT_ACTIONS.PAID,
    operator,
    reason || '',
    beforeStatus,
    'paid'
  );
  
  return { success: true, milestoneId, message: '付款已确认完成' };
}

function getPaymentHistory(milestoneId) {
  return queryAll(
    'SELECT * FROM payment_history WHERE milestone_id = ? ORDER BY created_at DESC',
    [milestoneId]
  );
}

function getPaymentTriggerLogs(milestoneId) {
  const logs = queryAll(
    'SELECT * FROM payment_trigger_logs WHERE milestone_id = ? ORDER BY created_at DESC',
    [milestoneId]
  );
  
  return logs.map(log => ({
    ...log,
    details_parsed: log.details ? JSON.parse(log.details) : null
  }));
}

module.exports = {
  PAYMENT_TRIGGER_TYPES,
  PAYMENT_ACTIONS,
  getMilestonePaymentStatus,
  checkPaymentTrigger,
  checkAndUpdatePaymentStatus,
  approvePayment,
  confirmPayment,
  getPaymentHistory,
  getPaymentTriggerLogs,
  recordPaymentHistory,
  recordPaymentTriggerLog
};
