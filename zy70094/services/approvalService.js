const { runQuery, getQuery, allQuery } = require('../database');
const { generateId, getCurrentTime, createError, validateRequiredFields } = require('../utils/helpers');
const { APPROVAL_STATUSES, APPROVAL_NODE_TYPES, APPLICATION_STATUSES, OPERATION_TYPES, ERROR_CODES } = require('../utils/constants');
const applicationService = require('./applicationService');
const logService = require('./logService');

const APPROVAL_FLOW = [
  APPROVAL_NODE_TYPES.INITIAL_REVIEW,
  APPROVAL_NODE_TYPES.TECHNICAL_REVIEW,
  APPROVAL_NODE_TYPES.FINAL_APPROVAL
];

async function createApprovalFlow(applicationId, operator = 'system') {
  const application = await applicationService.getApplicationById(applicationId);
  
  const existingApprovals = await allQuery(
    'SELECT * FROM approvals WHERE application_id = ? ORDER BY create_time ASC',
    [applicationId]
  );
  
  if (existingApprovals.length > 0) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `该申请单已存在审批流程，共 ${existingApprovals.length} 个审批节点`
    );
  }
  
  const currentTime = getCurrentTime();
  const createdApprovals = [];
  
  for (let i = 0; i < APPROVAL_FLOW.length; i++) {
    const id = generateId();
    const nodeType = APPROVAL_FLOW[i];
    
    await runQuery(
      `INSERT INTO approvals (id, application_id, node_type, status, create_time, update_time, version)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, applicationId, nodeType, APPROVAL_STATUSES.PENDING, currentTime, currentTime, 1]
    );
    
    const approval = await getQuery('SELECT * FROM approvals WHERE id = ?', [id]);
    createdApprovals.push(approval);
  }
  
  await applicationService.updateApplicationStatus(
    applicationId,
    APPLICATION_STATUSES.PENDING_APPROVAL,
    operator,
    '已创建审批流程'
  );
  
  await logService.createLog(
    applicationId,
    OPERATION_TYPES.APPROVAL_REVIEW,
    operator,
    null,
    { approvalNodes: APPROVAL_FLOW.length },
    '审批流程已创建，等待审批'
  );
  
  return createdApprovals;
}

async function getApprovalById(id) {
  const approval = await getQuery('SELECT * FROM approvals WHERE id = ?', [id]);
  
  if (!approval) {
    throw createError(ERROR_CODES.NOT_FOUND, '审批节点不存在');
  }
  
  return approval;
}

async function getApprovalsByApplication(applicationId) {
  return await allQuery(
    'SELECT * FROM approvals WHERE application_id = ? ORDER BY create_time ASC',
    [applicationId]
  );
}

async function getCurrentApprovalNode(applicationId) {
  const approvals = await getApprovalsByApplication(applicationId);
  
  if (approvals.length === 0) {
    return null;
  }
  
  for (const approval of approvals) {
    if (approval.status === APPROVAL_STATUSES.PENDING) {
      return approval;
    }
  }
  
  return approvals[approvals.length - 1];
}

async function reviewApproval(id, result, approver = null, remark = null, operator = 'system') {
  const approval = await getApprovalById(id);
  
  if (approval.status !== APPROVAL_STATUSES.PENDING) {
    throw createError(
      ERROR_CODES.CONFLICT,
      `审批节点当前状态为 ${approval.status}，无法进行审批`
    );
  }
  
  if (!Object.values(APPROVAL_STATUSES).includes(result)) {
    throw createError(
      ERROR_CODES.BAD_REQUEST,
      `无效的审批结果: ${result}`
    );
  }
  
  const currentTime = getCurrentTime();
  const newVersion = approval.version + 1;
  
  await runQuery(
    `UPDATE approvals SET approver = ?, approval_result = ?, approval_time = ?, status = ?, update_time = ?, version = ?, remark = ?
     WHERE id = ? AND version = ?`,
    [approver, result, currentTime, result, currentTime, newVersion, remark, id, approval.version]
  );
  
  const updatedApproval = await getApprovalById(id);
  
  await logService.createLog(
    approval.application_id,
    OPERATION_TYPES.APPROVAL_REVIEW,
    operator,
    { status: approval.status, nodeType: approval.node_type },
    { status: updatedApproval.status, result },
    remark || `审批节点 ${approval.node_type} 已处理，结果: ${result}`
  );
  
  await handleApprovalResult(approval.application_id, result, operator);
  
  return updatedApproval;
}

async function handleApprovalResult(applicationId, result, operator) {
  const approvals = await getApprovalsByApplication(applicationId);
  
  if (result === APPROVAL_STATUSES.REJECTED) {
    await applicationService.updateApplicationStatus(
      applicationId,
      APPLICATION_STATUSES.REJECTED,
      operator,
      '审批被驳回'
    );
    return;
  }
  
  if (result === APPROVAL_STATUSES.NEEDS_SUPPLEMENT) {
    await applicationService.updateApplicationStatus(
      applicationId,
      APPLICATION_STATUSES.PENDING_SUPPLEMENT,
      operator,
      '需要补充材料'
    );
    return;
  }
  
  if (result === APPROVAL_STATUSES.APPROVED) {
    const pendingApprovals = approvals.filter(a => a.status === APPROVAL_STATUSES.PENDING);
    
    if (pendingApprovals.length === 0) {
      await applicationService.updateApplicationStatus(
        applicationId,
        APPLICATION_STATUSES.APPROVED,
        operator,
        '所有审批节点已通过'
      );
    } else {
      await applicationService.updateApplicationStatus(
        applicationId,
        APPLICATION_STATUSES.APPROVAL_IN_PROGRESS,
        operator,
        '审批流程进行中'
      );
    }
  }
}

async function restartApprovalFlow(applicationId, operator = 'system') {
  const application = await applicationService.getApplicationById(applicationId);
  
  const currentTime = getCurrentTime();
  
  await runQuery(
    `UPDATE approvals SET status = ?, approver = NULL, approval_result = NULL, approval_time = NULL, update_time = ?, version = version + 1
     WHERE application_id = ?`,
    [APPROVAL_STATUSES.PENDING, currentTime, applicationId]
  );
  
  await applicationService.updateApplicationStatus(
    applicationId,
    APPLICATION_STATUSES.PENDING_APPROVAL,
    operator,
    '审批流程已重置'
  );
  
  await logService.createLog(
    applicationId,
    OPERATION_TYPES.STATUS_CHANGE,
    operator,
    { status: application.status },
    { status: APPLICATION_STATUSES.PENDING_APPROVAL },
    '审批流程已重置，所有节点恢复待审批状态'
  );
  
  return await getApprovalsByApplication(applicationId);
}

module.exports = {
  createApprovalFlow,
  getApprovalById,
  getApprovalsByApplication,
  getCurrentApprovalNode,
  reviewApproval,
  restartApprovalFlow,
  APPROVAL_FLOW
};
