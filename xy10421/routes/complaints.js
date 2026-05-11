const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const rules = require('../services/rules');

const COMPLAINT_STATUS = {
  CREATED: 'created',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid',
  CLOSED: 'closed'
};

function generateIdempotencyKey(req) {
  const bodyStr = JSON.stringify(req.body);
  return crypto.createHash('sha256').update(bodyStr).digest('hex');
}

function jsonResponse(res, statusCode, data) {
  res.status(statusCode).json(data);
}

router.post('/', (req, res) => {
  const { orderId, agentId, problemType, level, description } = req.body;
  const idempKey = generateIdempotencyKey(req);
  
  const existing = store.getIdempotencyRecord(idempKey);
  if (existing) {
    return jsonResponse(res, 200, existing);
  }
  
  if (!orderId || !agentId || !problemType || !level) {
    return jsonResponse(res, 400, { error: '缺少必要参数' });
  }
  
  const order = store.getOrderById(orderId);
  if (!order) {
    return jsonResponse(res, 404, { error: '订单不存在' });
  }
  
  const agent = store.getAgentById(agentId);
  if (!agent) {
    return jsonResponse(res, 404, { error: '客服不存在' });
  }
  
  if (!rules.isValidLevel(level)) {
    return jsonResponse(res, 400, { error: '无效的问题等级' });
  }
  
  const complaint = {
    complaintId: uuidv4(),
    orderId,
    customerId: order.customerId,
    agentId,
    agentName: agent.name,
    problemType,
    level,
    description: description || '',
    status: COMPLAINT_STATUS.CREATED,
    compensation: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  store.addComplaint(complaint);
  
  const response = {
    success: true,
    complaintId: complaint.complaintId,
    status: complaint.status,
    order: {
      orderId: order.orderId,
      amount: order.amount
    },
    maxCompensation: rules.calculateMaxCompensation(order, level)
  };
  
  store.setIdempotencyRecord(idempKey, response);
  
  jsonResponse(res, 201, response);
});

router.get('/:complaintId', (req, res) => {
  const complaint = store.getComplaintById(req.params.complaintId);
  if (!complaint) {
    return jsonResponse(res, 404, { error: '投诉不存在' });
  }
  
  const order = store.getOrderById(complaint.orderId);
  jsonResponse(res, 200, {
    complaint,
    order: order ? { orderId: order.orderId, amount: order.amount } : null
  });
});

router.post('/:complaintId/calculate', (req, res) => {
  const { requestedAmount } = req.body;
  const complaint = store.getComplaintById(req.params.complaintId);
  
  if (!complaint) {
    return jsonResponse(res, 404, { error: '投诉不存在' });
  }
  
  if (complaint.status === COMPLAINT_STATUS.CLOSED) {
    return jsonResponse(res, 400, { error: '投诉已结案，不能修改' });
  }
  
  const order = store.getOrderById(complaint.orderId);
  if (!order) {
    return jsonResponse(res, 404, { error: '关联订单不存在' });
  }
  
  if (typeof requestedAmount !== 'number' || requestedAmount <= 0) {
    return jsonResponse(res, 400, { error: '请输入有效的赔偿金额' });
  }
  
  const evaluation = rules.evaluateCompensation(order, complaint.level, requestedAmount);
  
  jsonResponse(res, 200, {
    complaintId: complaint.complaintId,
    orderId: order.orderId,
    level: complaint.level,
    ...evaluation
  });
});

router.post('/:complaintId/submit', (req, res) => {
  const { requestedAmount, reason } = req.body;
  const idempKey = `${req.params.complaintId}:${generateIdempotencyKey(req)}`;
  
  const existing = store.getIdempotencyRecord(idempKey);
  if (existing) {
    return jsonResponse(res, 200, existing);
  }
  
  const complaint = store.getComplaintById(req.params.complaintId);
  
  if (!complaint) {
    return jsonResponse(res, 404, { error: '投诉不存在' });
  }
  
  if (complaint.status === COMPLAINT_STATUS.CLOSED) {
    return jsonResponse(res, 400, { error: '投诉已结案，不能修改' });
  }
  
  if (complaint.status !== COMPLAINT_STATUS.CREATED) {
    return jsonResponse(res, 400, { error: `投诉状态为 ${complaint.status}，无法提交` });
  }
  
  const order = store.getOrderById(complaint.orderId);
  if (!order) {
    return jsonResponse(res, 404, { error: '关联订单不存在' });
  }
  
  if (typeof requestedAmount !== 'number' || requestedAmount <= 0) {
    return jsonResponse(res, 400, { error: '请输入有效的赔偿金额' });
  }
  
  const evaluation = rules.evaluateCompensation(order, complaint.level, requestedAmount);
  
  if (!evaluation.canApprove) {
    return jsonResponse(res, 400, {
      error: evaluation.reason,
      maxCompensation: evaluation.maxForLevel,
      cumulativeTotal: evaluation.cumulativeTotal
    });
  }
  
  const rule = rules.getLevelRule(complaint.level);
  const compensation = {
    compensationId: uuidv4(),
    complaintId: complaint.complaintId,
    orderId: order.orderId,
    amount: requestedAmount,
    reason: reason || '',
    level: complaint.level,
    submittedBy: complaint.agentId,
    submittedAt: new Date().toISOString(),
    approvedBy: null,
    approvedAt: null,
    status: rule.needsApproval ? 'pending_approval' : 'approved'
  };
  
  store.addCompensation(compensation);
  
  const updatedComplaint = store.updateComplaint(complaint.complaintId, {
    status: rule.needsApproval ? COMPLAINT_STATUS.SUBMITTED : COMPLAINT_STATUS.APPROVED,
    compensation: {
      amount: requestedAmount,
      compensationId: compensation.compensationId,
      status: compensation.status
    },
    updatedAt: new Date().toISOString()
  });
  
  const response = {
    success: true,
    complaintId: complaint.complaintId,
    status: updatedComplaint.status,
    compensation: {
      amount: requestedAmount,
      status: compensation.status,
      autoApproved: !rule.needsApproval
    }
  };
  
  store.setIdempotencyRecord(idempKey, response);
  
  jsonResponse(res, 200, response);
});

router.post('/:complaintId/approve', (req, res) => {
  const { supervisorId, action, comment } = req.body;
  const idempKey = `approve:${req.params.complaintId}:${supervisorId}:${action}:${JSON.stringify(comment || '')}`;
  
  const existing = store.getIdempotencyRecord(idempKey);
  if (existing) {
    return jsonResponse(res, 200, existing);
  }
  
  const complaint = store.getComplaintById(req.params.complaintId);
  
  if (!complaint) {
    return jsonResponse(res, 404, { error: '投诉不存在' });
  }
  
  if (complaint.status === COMPLAINT_STATUS.CLOSED) {
    return jsonResponse(res, 400, { error: '投诉已结案，不能修改' });
  }
  
  if (complaint.status !== COMPLAINT_STATUS.SUBMITTED) {
    return jsonResponse(res, 400, { error: `投诉状态为 ${complaint.status}，无法审批` });
  }
  
  const supervisor = store.getAgentById(supervisorId);
  if (!supervisor || supervisor.role !== 'supervisor') {
    return jsonResponse(res, 403, { error: '无审批权限' });
  }
  
  if (action !== 'approve' && action !== 'reject') {
    return jsonResponse(res, 400, { error: '操作必须是 approve 或 reject' });
  }
  
  const data = store.getStatistics();
  const compensation = data.compensations.find(c => c.complaintId === complaint.complaintId);
  
  let newComplaintStatus;
  let newCompensationStatus;
  
  if (action === 'approve') {
    newComplaintStatus = COMPLAINT_STATUS.APPROVED;
    newCompensationStatus = 'approved';
  } else {
    newComplaintStatus = COMPLAINT_STATUS.REJECTED;
    newCompensationStatus = 'rejected';
  }
  
  const updatedComplaint = store.updateComplaint(complaint.complaintId, {
    status: newComplaintStatus,
    updatedAt: new Date().toISOString(),
    compensation: {
      ...complaint.compensation,
      status: newCompensationStatus,
      approvedBy: supervisorId,
      approvedAt: new Date().toISOString(),
      comment: comment || ''
    }
  });
  
  const response = {
    success: true,
    complaintId: complaint.complaintId,
    action,
    status: newComplaintStatus,
    approvedBy: supervisor.name,
    approvedAt: new Date().toISOString()
  };
  
  store.setIdempotencyRecord(idempKey, response);
  
  jsonResponse(res, 200, response);
});

router.post('/:complaintId/close', (req, res) => {
  const idempKey = `close:${req.params.complaintId}`;
  
  const existing = store.getIdempotencyRecord(idempKey);
  if (existing) {
    return jsonResponse(res, 200, existing);
  }
  
  const complaint = store.getComplaintById(req.params.complaintId);
  
  if (!complaint) {
    return jsonResponse(res, 404, { error: '投诉不存在' });
  }
  
  if (complaint.status === COMPLAINT_STATUS.CLOSED) {
    return jsonResponse(res, 400, { error: '投诉已结案' });
  }
  
  if (complaint.status !== COMPLAINT_STATUS.APPROVED && complaint.status !== COMPLAINT_STATUS.REJECTED) {
    return jsonResponse(res, 400, { error: `投诉状态为 ${complaint.status}，无法结案。请先完成审批。` });
  }
  
  if (complaint.status === COMPLAINT_STATUS.APPROVED && complaint.compensation) {
    store.updateCompensation(complaint.complaintId, {
      status: 'paid',
      paidAt: new Date().toISOString()
    });
  }
  
  const updatedComplaint = store.updateComplaint(complaint.complaintId, {
    status: COMPLAINT_STATUS.CLOSED,
    closedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  const response = {
    success: true,
    complaintId: complaint.complaintId,
    status: COMPLAINT_STATUS.CLOSED,
    closedAt: updatedComplaint.closedAt
  };
  
  store.setIdempotencyRecord(idempKey, response);
  
  jsonResponse(res, 200, response);
});

module.exports = router;
