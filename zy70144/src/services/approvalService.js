const { v4: uuidv4 } = require('uuid');
const { table, insert, updateById } = require('../config/database');
const auditService = require('./auditService');

function requestApproval(artifactId, requestor, comment = null) {
  const now = new Date().toISOString();
  const id = uuidv4();

  insert('approvals', {
    id,
    artifact_id: artifactId,
    requestor,
    approver: null,
    status: 'pending',
    comment,
    requested_at: now,
    approved_at: null,
    rejected_at: null
  });

  auditService.logAction('approval', id, 'request', requestor, {
    artifactId,
    comment
  });

  return getApprovalById(id);
}

function approve(approvalId, approver, comment = null) {
  const approval = table('approvals').where('id', '=', approvalId).get();
  if (!approval) {
    throw new Error('审批记录不存在');
  }
  if (approval.status !== 'pending') {
    throw new Error('审批状态已更新，无法重复操作');
  }

  const now = new Date().toISOString();
  updateById('approvals', approvalId, {
    approver,
    status: 'approved',
    comment: comment || approval.comment,
    approved_at: now
  });

  auditService.logAction('approval', approvalId, 'approve', approver, {
    artifactId: approval.artifact_id
  });

  return getApprovalById(approvalId);
}

function reject(approvalId, approver, reason = null) {
  const approval = table('approvals').where('id', '=', approvalId).get();
  if (!approval) {
    throw new Error('审批记录不存在');
  }
  if (approval.status !== 'pending') {
    throw new Error('审批状态已更新，无法重复操作');
  }

  const now = new Date().toISOString();
  updateById('approvals', approvalId, {
    approver,
    status: 'rejected',
    comment: reason,
    rejected_at: now
  });

  auditService.logAction('approval', approvalId, 'reject', approver, {
    artifactId: approval.artifact_id,
    reason
  });

  return getApprovalById(approvalId);
}

function getApprovalById(id) {
  return table('approvals').where('id', '=', id).get();
}

function getApprovalsForArtifact(artifactId) {
  return table('approvals')
    .where('artifact_id', '=', artifactId)
    .orderBy('requested_at', 'DESC')
    .all();
}

function hasApprovedApproval(artifactId) {
  const count = table('approvals')
    .where('artifact_id', '=', artifactId)
    .where('status', '=', 'approved')
    .count();
  return count > 0;
}

function getPendingApprovals(artifactId = null) {
  let query = table('approvals').where('status', '=', 'pending');
  
  if (artifactId) {
    query = query.where('artifact_id', '=', artifactId);
  }
  
  return query.orderBy('requested_at', 'DESC').all();
}

module.exports = {
  requestApproval,
  approve,
  reject,
  getApprovalById,
  getApprovalsForArtifact,
  hasApprovedApproval,
  getPendingApprovals
};
