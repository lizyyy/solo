const batchModel = require('../models/batch');

const STATUS_TRANSITIONS = {
  draft: {
    canTransitionTo: ['submitted', 'cancelled'],
    allowedRoles: ['entry', 'manager']
  },
  submitted: {
    canTransitionTo: ['reviewing', 'draft', 'frozen', 'cancelled'],
    allowedRoles: ['entry', 'reviewer', 'manager']
  },
  reviewing: {
    canTransitionTo: ['approved', 'rejected', 'submitted', 'frozen'],
    allowedRoles: ['reviewer', 'manager']
  },
  approved: {
    canTransitionTo: ['settled', 'frozen', 'archived'],
    allowedRoles: ['reviewer', 'manager']
  },
  rejected: {
    canTransitionTo: ['draft', 'frozen', 'cancelled'],
    allowedRoles: ['reviewer', 'manager']
  },
  frozen: {
    canTransitionTo: ['*'],
    allowedRoles: ['manager']
  },
  settled: {
    canTransitionTo: ['archived', 'frozen'],
    allowedRoles: ['manager']
  },
  archived: {
    canTransitionTo: ['frozen'],
    allowedRoles: ['manager']
  },
  cancelled: {
    canTransitionTo: ['frozen'],
    allowedRoles: ['manager']
  }
};

function canTransition(fromStatus, toStatus, userRole) {
  const currentState = STATUS_TRANSITIONS[fromStatus];
  if (!currentState) {
    return false;
  }
  
  if (!currentState.allowedRoles.includes(userRole)) {
    return false;
  }
  
  if (currentState.canTransitionTo[0] === '*') {
    return true;
  }
  
  return currentState.canTransitionTo.includes(toStatus);
}

function getAvailableTransitions(status, userRole) {
  const currentState = STATUS_TRANSITIONS[status];
  if (!currentState) {
    return [];
  }
  
  if (!currentState.allowedRoles.includes(userRole)) {
    return [];
  }
  
  if (currentState.canTransitionTo[0] === '*') {
    return Object.keys(STATUS_TRANSITIONS).filter(s => s !== status);
  }
  
  return currentState.canTransitionTo;
}

function submitBatch(batchId, userId, userRole) {
  const batch = batchModel.getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (!canTransition(batch.status, 'submitted', userRole)) {
    throw new Error(`无法从 ${batch.status} 提交批次`);
  }
  
  return batchModel.updateBatchStatus(batchId, 'submitted', userId, '提交审核');
}

function startReview(batchId, userId, userRole) {
  const batch = batchModel.getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (!canTransition(batch.status, 'reviewing', userRole)) {
    throw new Error(`无法从 ${batch.status} 开始复核`);
  }
  
  return batchModel.updateBatchStatus(batchId, 'reviewing', userId, '开始复核', {
    reviewer_id: userId
  });
}

function approveBatch(batchId, userId, userRole, reason = '') {
  const batch = batchModel.getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (!canTransition(batch.status, 'approved', userRole)) {
    throw new Error(`无法从 ${batch.status} 批准批次`);
  }
  
  return batchModel.updateBatchStatus(batchId, 'approved', userId, reason || '复核通过');
}

function rejectBatch(batchId, userId, userRole, reason = '') {
  const batch = batchModel.getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (!canTransition(batch.status, 'rejected', userRole)) {
    throw new Error(`无法从 ${batch.status} 驳回批次`);
  }
  
  return batchModel.updateBatchStatus(batchId, 'rejected', userId, reason || '复核驳回');
}

function freezeBatch(batchId, userId, userRole, reason) {
  const batch = batchModel.getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (userRole !== 'manager') {
    throw new Error('只有主管可以冻结批次');
  }
  
  return batchModel.freezeBatch(batchId, userId, reason);
}

function unfreezeBatch(batchId, userId, userRole, reason) {
  const batch = batchModel.getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (userRole !== 'manager') {
    throw new Error('只有主管可以解冻批次');
  }
  
  return batchModel.unfreezeBatch(batchId, userId, reason);
}

function archiveBatch(batchId, userId, userRole, reason = '') {
  const batch = batchModel.getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (!canTransition(batch.status, 'archived', userRole)) {
    throw new Error(`无法从 ${batch.status} 归档批次`);
  }
  
  return batchModel.archiveBatch(batchId, userId, reason || '归档');
}

function cancelBatch(batchId, userId, userRole, reason = '') {
  const batch = batchModel.getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (!canTransition(batch.status, 'cancelled', userRole)) {
    throw new Error(`无法从 ${batch.status} 撤销批次`);
  }
  
  return batchModel.cancelBatch(batchId, userId, reason || '撤销');
}

function settleBatch(batchId, userId, userRole, reason = '') {
  const batch = batchModel.getBatchById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }
  
  if (!canTransition(batch.status, 'settled', userRole)) {
    throw new Error(`无法从 ${batch.status} 结算批次`);
  }
  
  return batchModel.updateBatchStatus(batchId, 'settled', userId, reason || '结算');
}

module.exports = {
  STATUS_TRANSITIONS,
  canTransition,
  getAvailableTransitions,
  submitBatch,
  startReview,
  approveBatch,
  rejectBatch,
  freezeBatch,
  unfreezeBatch,
  archiveBatch,
  cancelBatch,
  settleBatch
};
