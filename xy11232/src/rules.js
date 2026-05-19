const storage = require('./storage');

const DANGER_LEVELS = {
  0: { name: '无危险', requiresDoubleApproval: false },
  1: { name: '低危', requiresDoubleApproval: false },
  2: { name: '中危', requiresDoubleApproval: false },
  3: { name: '高危', requiresDoubleApproval: true },
  4: { name: '剧毒', requiresDoubleApproval: true }
};

function validateApplication(application) {
  const errors = [];
  const warnings = [];

  const reagent = storage.getReagent(application.reagentId);
  if (!reagent) {
    errors.push(`试剂 ${application.reagentId} 不存在`);
    return { valid: false, errors, warnings };
  }

  const inventory = storage.getInventory();
  const currentStock = inventory[application.reagentId] || 0;
  if (currentStock < application.quantity) {
    errors.push(`库存不足: ${reagent.name} 当前库存 ${currentStock} ${reagent.unit}，申请 ${application.quantity} ${reagent.unit}`);
  }

  if (application.quantity <= 0) {
    errors.push('申请数量必须大于0');
  }

  const dangerInfo = DANGER_LEVELS[reagent.dangerLevel] || DANGER_LEVELS[0];
  if (dangerInfo.requiresDoubleApproval) {
    warnings.push(`注意: ${reagent.name} 为${dangerInfo.name}试剂，需要双人审批`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    reagent,
    currentStock,
    requiresDoubleApproval: dangerInfo.requiresDoubleApproval
  };
}

function canApprove(application, approver) {
  const reagent = storage.getReagent(application.reagentId);
  if (!reagent) return { canApprove: false, reason: '试剂不存在' };

  const dangerInfo = DANGER_LEVELS[reagent.dangerLevel] || DANGER_LEVELS[0];
  
  if (!dangerInfo.requiresDoubleApproval) {
    return { canApprove: true, reason: '普通试剂单人审批即可' };
  }

  const existingApprovals = storage.getApprovals().filter(a => a.applicationId === application.id && a.status === 'approved');
  const hasApproved = existingApprovals.some(a => a.approver === approver);
  
  if (hasApproved) {
    return { canApprove: false, reason: '您已审批过此申请' };
  }

  if (existingApprovals.length === 0) {
    return { canApprove: true, reason: '第一审批人通过，还需第二审批人' };
  }

  return { canApprove: true, reason: '第二审批人通过，申请完成' };
}

function isFullyApproved(application) {
  const reagent = storage.getReagent(application.reagentId);
  if (!reagent) return false;

  const dangerInfo = DANGER_LEVELS[reagent.dangerLevel] || DANGER_LEVELS[0];
  if (!dangerInfo.requiresDoubleApproval) return true;

  const approvals = storage.getApprovals().filter(a => a.applicationId === application.id && a.status === 'approved');
  return approvals.length >= 2;
}

function approveApplication(applicationId, approver, reason) {
  const application = storage.getApplications().find(a => a.id === applicationId);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  if (application.status === 'approved') {
    return { success: false, error: '申请已通过审批' };
  }

  const approvalCheck = canApprove(application, approver);
  if (!approvalCheck.canApprove) {
    return { success: false, error: approvalCheck.reason };
  }

  storage.addApproval({
    applicationId,
    approver,
    status: 'approved',
    reason
  });

  const reagent = storage.getReagent(application.reagentId);
  const dangerInfo = DANGER_LEVELS[reagent.dangerLevel] || DANGER_LEVELS[0];
  const approvals = storage.getApprovals().filter(a => a.applicationId === applicationId && a.status === 'approved');

  let finalStatus = 'pending';
  let message = approvalCheck.reason;

  if (!dangerInfo.requiresDoubleApproval || approvals.length >= 2) {
    const inventory = storage.getInventory();
    storage.updateInventory(application.reagentId, -application.quantity);
    finalStatus = 'approved';
    message = dangerInfo.requiresDoubleApproval ? '双人审批完成，库存已扣减' : '审批完成，库存已扣减';
  }

  storage.updateApplication(applicationId, { status: finalStatus });
  storage.addHistory('approve', { applicationId, approver, reason });

  return {
    success: true,
    status: finalStatus,
    message,
    approvalsCount: approvals.length,
    requiredApprovals: dangerInfo.requiresDoubleApproval ? 2 : 1
  };
}

function rejectApplication(applicationId, approver, reason) {
  const application = storage.getApplications().find(a => a.id === applicationId);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  if (application.status === 'approved') {
    return { success: false, error: '已通过的申请不能驳回' };
  }

  storage.addApproval({
    applicationId,
    approver,
    status: 'rejected',
    reason
  });

  storage.updateApplication(applicationId, { status: 'rejected' });
  storage.addHistory('reject', { applicationId, approver, reason });

  return {
    success: true,
    status: 'rejected',
    message: '申请已驳回'
  };
}

function resubmitApplication(applicationId) {
  const application = storage.getApplications().find(a => a.id === applicationId);
  if (!application) {
    return { success: false, error: '申请不存在' };
  }

  if (application.status !== 'rejected') {
    return { success: false, error: '只有被驳回的申请才能重新提交' };
  }

  const validation = validateApplication(application);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  storage.updateApplication(applicationId, { status: 'pending' });
  storage.addHistory('resubmit', { applicationId });

  return {
    success: true,
    status: 'pending',
    message: '申请已重新提交，等待审批',
    warnings: validation.warnings
  };
}

module.exports = {
  DANGER_LEVELS,
  validateApplication,
  canApprove,
  isFullyApproved,
  approveApplication,
  rejectApplication,
  resubmitApplication
};
