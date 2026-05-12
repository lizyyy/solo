const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const store = require('../config/store');
const { 
  ORDER_STATUS, 
  CHECKPOINT_TYPE, 
  CHECKPOINT_STATUS, 
  SUPPLEMENT_STATUS,
  MAX_SUPPLEMENT_ATTEMPTS 
} = require('../config/constants');
const {
  getOrderByNo,
  getOrderItems,
  getOrderDocuments,
  getOrderSupplements,
  updateOrderStatus,
  recordCheckpoint
} = require('../services/orderService');
const rules = require('../services/rules');

router.post('/precheck', (req, res) => {
  const { order_no, idempotent_key, checked_by } = req.body;

  if (!order_no) {
    return res.status(400).json({ success: false, message: '缺少订单号' });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const idempotentKey = idempotent_key || `precheck_${order_no}`;
  const checkpointResult = recordCheckpoint(
    order.id,
    CHECKPOINT_TYPE.PRECHECK,
    CHECKPOINT_STATUS.PENDING,
    false,
    {},
    idempotentKey,
    checked_by || 'system'
  );

  if (checkpointResult.isDuplicate) {
    const cp = checkpointResult.checkpoint;
    return res.json({
      success: true,
      isDuplicate: true,
      message: '清关预检请求已处理，幂等性保护',
      data: {
        checkpoint_no: cp.checkpoint_no,
        passed: cp.passed === 1,
        details: cp.details ? JSON.parse(cp.details) : null
      }
    });
  }

  const items = getOrderItems(order.id);
  const documents = getOrderDocuments(order.id);
  const validTaxCodes = store.findMany('tax_codes');
  const supplements = getOrderSupplements(order.id);
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const precheckResult = rules.precheckOrder(order, items, documents, validTaxCodes);

  const checkpoints = store.findMany('checkpoints', c => c.idempotent_key === idempotentKey);
  if (checkpoints.length > 0) {
    const cpId = checkpoints[checkpoints.length - 1].id;
    store.update('checkpoints', c => c.id === cpId, {
      status: precheckResult.passed ? CHECKPOINT_STATUS.PASSED : CHECKPOINT_STATUS.FAILED,
      passed: precheckResult.passed ? 1 : 0,
      error_code: precheckResult.passed ? null : 'PRECHECK_FAILED',
      error_message: precheckResult.passed ? null : `发现${precheckResult.issueCount}个问题`,
      executed_at: now,
      details: JSON.stringify(precheckResult)
    });
  }

  let newStatus;
  if (precheckResult.passed) {
    newStatus = ORDER_STATUS.READY;
    updateOrderStatus(order.id, ORDER_STATUS.READY, '清关预检通过，准备放行', { precheckResult }, checked_by || 'system');
  } else {
    newStatus = ORDER_STATUS.PRECHECK_FAILED;
    updateOrderStatus(order.id, ORDER_STATUS.PRECHECK_FAILED, '清关预检失败', { issues: precheckResult.issues }, checked_by || 'system');
    
    const supplementCheck = rules.canRequestSupplement(supplements);
    if (supplementCheck.canRequest) {
      const supplementNo = `SP-${dayjs().format('YYYYMMDD')}-${String(supplements.length + 1).padStart(3, '0')}`;
      const requestedAt = now;
      const deadlineAt = rules.calculateDeadline(requestedAt);
      
      const firstIssue = precheckResult.issues[0];
      
      store.insert('supplements', {
        id: uuidv4(),
        order_id: order.id,
        supplement_no: supplementNo,
        reason_code: firstIssue.reasonCode,
        reason_text: firstIssue.reasonText,
        status: SUPPLEMENT_STATUS.REQUESTED,
        attempt_no: supplements.length + 1,
        requested_at: requestedAt,
        deadline_at: deadlineAt,
        request_content: JSON.stringify({ issues: precheckResult.issues }),
        submit_content: null,
        approved_by: null,
        approved_at: null,
        approved_remark: null,
        idempotent_key: null
      });
      
      newStatus = ORDER_STATUS.SUPPLEMENT_PENDING;
      updateOrderStatus(order.id, ORDER_STATUS.SUPPLEMENT_PENDING, `已创建补件申请: ${supplementNo}`, { 
        supplementNo, 
        issues: precheckResult.issues,
        attempt_no: supplements.length + 1,
        max_attempts: MAX_SUPPLEMENT_ATTEMPTS
      }, checked_by || 'system');
    } else {
      newStatus = ORDER_STATUS.REJECTED;
      updateOrderStatus(order.id, ORDER_STATUS.REJECTED, supplementCheck.reason, { supplementCheck }, checked_by || 'system');
    }
  }

  res.json({
    success: true,
    message: precheckResult.passed ? '清关预检通过' : '清关预检存在问题',
    data: {
      order_no,
      passed: precheckResult.passed,
      status: newStatus,
      issue_count: precheckResult.issueCount,
      issues: precheckResult.issues
    }
  });
});

router.post('/supplement/request', (req, res) => {
  const { order_no, reason_code, reason_text, request_content, requested_by, idempotent_key } = req.body;

  if (!order_no || !reason_code || !reason_text) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['order_no', 'reason_code', 'reason_text']
    });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const supplements = getOrderSupplements(order.id);
  const supplementCheck = rules.canRequestSupplement(supplements);

  if (!supplementCheck.canRequest) {
    return res.status(400).json({
      success: false,
      message: supplementCheck.reason,
      data: supplementCheck
    });
  }

  const isDuplicateReason = supplements.some(s => s.reason_code === reason_code);
  
  const idempotentKey = idempotent_key || `supp_req_${order_no}_${reason_code}`;
  const existing = store.findOne('supplements', s => s.idempotent_key === idempotentKey);
  
  if (existing) {
    return res.json({
      success: true,
      isDuplicate: true,
      is_duplicate_reason: isDuplicateReason,
      message: '补件申请已存在，幂等性保护',
      data: {
        supplement_no: existing.supplement_no,
        status: existing.status
      }
    });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const supplementNo = `SP-${dayjs().format('YYYYMMDD')}-${String(supplements.length + 1).padStart(3, '0')}`;
  const deadlineAt = rules.calculateDeadline(now);

  store.insert('supplements', {
    id: uuidv4(),
    order_id: order.id,
    supplement_no: supplementNo,
    reason_code,
    reason_text,
    status: SUPPLEMENT_STATUS.REQUESTED,
    attempt_no: supplements.length + 1,
    requested_at: now,
    deadline_at: deadlineAt,
    request_content: request_content ? JSON.stringify(request_content) : null,
    submit_content: null,
    approved_by: null,
    approved_at: null,
    approved_remark: null,
    idempotent_key: idempotentKey
  });

  recordCheckpoint(
    order.id,
    CHECKPOINT_TYPE.SUPPLEMENT,
    CHECKPOINT_STATUS.PENDING,
    false,
    {
      action: 'supplement_requested',
      supplement_no: supplementNo,
      reason_code,
      reason_text,
      attempt_no: supplements.length + 1
    },
    null,
    requested_by || 'system'
  );

  updateOrderStatus(
    order.id,
    ORDER_STATUS.SUPPLEMENT_PENDING,
    `已创建补件申请: ${supplementNo}`,
    {
      supplement_no: supplementNo,
      reason_code,
      reason_text,
      attempt_no: supplements.length + 1,
      max_attempts: MAX_SUPPLEMENT_ATTEMPTS,
      deadline_at: deadlineAt,
      is_duplicate_reason: isDuplicateReason
    },
    requested_by || 'system'
  );

  res.json({
    success: true,
    message: '补件申请已创建',
    data: {
      order_no,
      supplement_no: supplementNo,
      reason_code,
      reason_text,
      status: SUPPLEMENT_STATUS.REQUESTED,
      attempt_no: supplements.length + 1,
      max_attempts: MAX_SUPPLEMENT_ATTEMPTS,
      deadline_at: deadlineAt,
      is_duplicate_reason: isDuplicateReason,
      remaining_hours: 72
    }
  });
});

router.post('/supplement/submit', (req, res) => {
  const { order_no, supplement_no, submit_content, submitted_by, idempotent_key } = req.body;

  if (!order_no || !supplement_no) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['order_no', 'supplement_no']
    });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const supplement = store.findOne('supplements', s => s.order_id === order.id && s.supplement_no === supplement_no);
  if (!supplement) {
    return res.status(404).json({ success: false, message: '补件申请不存在' });
  }

  const idempotentKey = idempotent_key || `supp_submit_${supplement_no}`;
  const existingSubmit = store.findOne('checkpoints', c => c.order_id === order.id && c.idempotent_key === idempotentKey);

  if (existingSubmit) {
    return res.json({
      success: true,
      isDuplicate: true,
      message: '补件已提交，幂等性保护',
      data: {
        supplement_no,
        submitted_at: existingSubmit.executed_at
      }
    });
  }

  if (supplement.status !== SUPPLEMENT_STATUS.REQUESTED) {
    return res.status(400).json({
      success: false,
      message: '补件状态不允许提交',
      current_status: supplement.status
    });
  }

  if (rules.checkSupplementTimeout(supplement)) {
    store.update('supplements', s => s.id === supplement.id, { status: SUPPLEMENT_STATUS.TIMEOUT });
    
    updateOrderStatus(order.id, ORDER_STATUS.SUPPLEMENT_TIMEOUT, `补件超时: ${supplement_no}`, { 
      supplement_no,
      deadline_at: supplement.deadline_at
    }, submitted_by || 'system');
    
    return res.status(400).json({
      success: false,
      message: '补件已超时',
      deadline_at: supplement.deadline_at
    });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  store.update('supplements', s => s.id === supplement.id, {
    status: SUPPLEMENT_STATUS.SUBMITTED,
    submitted_at: now,
    submit_content: submit_content ? JSON.stringify(submit_content) : null
  });

  recordCheckpoint(
    order.id,
    CHECKPOINT_TYPE.SUPPLEMENT,
    CHECKPOINT_STATUS.PASSED,
    true,
    {
      action: 'supplement_submitted',
      supplement_no,
      submitted_at: now
    },
    idempotentKey,
    submitted_by || 'system'
  );

  res.json({
    success: true,
    message: '补件已提交，等待审核',
    data: {
      order_no,
      supplement_no,
      status: SUPPLEMENT_STATUS.SUBMITTED,
      submitted_at: now
    }
  });
});

router.post('/supplement/approve', (req, res) => {
  const { order_no, supplement_no, approved_by, approved_remark, idempotent_key } = req.body;

  if (!order_no || !supplement_no || !approved_by) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['order_no', 'supplement_no', 'approved_by']
    });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const supplement = store.findOne('supplements', s => s.order_id === order.id && s.supplement_no === supplement_no);
  if (!supplement) {
    return res.status(404).json({ success: false, message: '补件申请不存在' });
  }

  const idempotentKey = idempotent_key || `supp_approve_${supplement_no}`;
  const existingApprove = store.findOne('checkpoints', c => c.order_id === order.id && c.idempotent_key === idempotentKey);

  if (existingApprove) {
    return res.json({
      success: true,
      isDuplicate: true,
      message: '补件已审核，幂等性保护',
      data: {
        supplement_no,
        status: supplement.status
      }
    });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  store.update('supplements', s => s.id === supplement.id, {
    status: SUPPLEMENT_STATUS.APPROVED,
    approved_by,
    approved_at: now,
    approved_remark: approved_remark || null
  });

  recordCheckpoint(
    order.id,
    CHECKPOINT_TYPE.SUPPLEMENT,
    CHECKPOINT_STATUS.PASSED,
    true,
    {
      action: 'supplement_approved',
      supplement_no,
      approved_by,
      approved_remark
    },
    idempotentKey,
    approved_by
  );

  updateOrderStatus(
    order.id,
    ORDER_STATUS.SUPPLEMENT_COMPLETED,
    `补件审核通过: ${supplement_no}`,
    { supplement_no, approved_by, approved_remark },
    approved_by
  );

  res.json({
    success: true,
    message: '补件审核通过，建议重新执行清关预检',
    data: {
      order_no,
      supplement_no,
      status: SUPPLEMENT_STATUS.APPROVED,
      approved_at: now,
      next_step: '请调用 /api/customs/precheck 重新执行清关预检'
    }
  });
});

router.post('/approve', (req, res) => {
  const { order_no, approved_by, idempotent_key } = req.body;

  if (!order_no || !approved_by) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['order_no', 'approved_by']
    });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const idempotentKey = idempotent_key || `approve_${order_no}`;
  const checkpointResult = recordCheckpoint(
    order.id,
    CHECKPOINT_TYPE.APPROVAL,
    CHECKPOINT_STATUS.PENDING,
    false,
    {},
    idempotentKey,
    approved_by
  );

  if (checkpointResult.isDuplicate) {
    return res.json({
      success: true,
      isDuplicate: true,
      message: '放行审批已处理，幂等性保护',
      data: {
        passed: checkpointResult.checkpoint.passed === 1,
        approved_at: checkpointResult.checkpoint.executed_at
      }
    });
  }

  if (order.status !== ORDER_STATUS.READY) {
    const checkpoints = store.findMany('checkpoints', c => c.idempotent_key === idempotentKey);
    if (checkpoints.length > 0) {
      const cpId = checkpoints[checkpoints.length - 1].id;
      store.update('checkpoints', c => c.id === cpId, {
        status: CHECKPOINT_STATUS.FAILED,
        passed: 0,
        error_message: `订单状态${order.status}不允许放行，当前必须为ready`,
        executed_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });
    }
    
    return res.status(400).json({
      success: false,
      message: '订单状态不允许放行',
      current_status: order.status,
      required_status: ORDER_STATUS.READY
    });
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  const checkpoints = store.findMany('checkpoints', c => c.idempotent_key === idempotentKey);
  if (checkpoints.length > 0) {
    const cpId = checkpoints[checkpoints.length - 1].id;
    store.update('checkpoints', c => c.id === cpId, {
      status: CHECKPOINT_STATUS.PASSED,
      passed: 1,
      executed_at: now
    });
  }

  updateOrderStatus(
    order.id,
    ORDER_STATUS.APPROVED,
    '清关放行审批通过',
    { approved_by, approved_at: now },
    approved_by
  );

  res.json({
    success: true,
    message: '放行审批通过，可以出库',
    data: {
      order_no,
      status: ORDER_STATUS.APPROVED,
      approved_by,
      approved_at: now,
      can_ship: true
    }
  });
});

router.post('/ship', (req, res) => {
  const { order_no, shipped_by, idempotent_key, waybill_no } = req.body;

  if (!order_no || !shipped_by) {
    return res.status(400).json({
      success: false,
      message: '缺少必填字段',
      required: ['order_no', 'shipped_by']
    });
  }

  const order = getOrderByNo(order_no);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }

  const idempotentKey = idempotent_key || `ship_${order_no}`;
  const checkpointResult = recordCheckpoint(
    order.id,
    CHECKPOINT_TYPE.SHIPMENT,
    CHECKPOINT_STATUS.PENDING,
    false,
    {},
    idempotentKey,
    shipped_by
  );

  if (checkpointResult.isDuplicate) {
    return res.json({
      success: true,
      isDuplicate: true,
      message: '出库已处理，幂等性保护',
      data: {
        shipped: checkpointResult.checkpoint.passed === 1,
        shipped_at: checkpointResult.checkpoint.executed_at
      }
    });
  }

  const allCheckpoints = store.findMany('checkpoints', c => c.order_id === order.id);
  const canShipCheck = rules.canShip(order.status, allCheckpoints);

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

  if (!canShipCheck.canShip) {
    const checkpoints = store.findMany('checkpoints', c => c.idempotent_key === idempotentKey);
    if (checkpoints.length > 0) {
      const cpId = checkpoints[checkpoints.length - 1].id;
      store.update('checkpoints', c => c.id === cpId, {
        status: CHECKPOINT_STATUS.FAILED,
        passed: 0,
        error_message: canShipCheck.reason,
        executed_at: now
      });
    }
    
    return res.status(400).json({
      success: false,
      message: canShipCheck.reason,
      data: canShipCheck
    });
  }

  const checkpoints = store.findMany('checkpoints', c => c.idempotent_key === idempotentKey);
  if (checkpoints.length > 0) {
    const cpId = checkpoints[checkpoints.length - 1].id;
    store.update('checkpoints', c => c.id === cpId, {
      status: CHECKPOINT_STATUS.PASSED,
      passed: 1,
      details: JSON.stringify({ waybill_no: waybill_no || null }),
      executed_at: now
    });
  }

  updateOrderStatus(
    order.id,
    ORDER_STATUS.SHIPPED,
    '订单已出库',
    { waybill_no: waybill_no || null, shipped_by, shipped_at: now },
    shipped_by
  );

  res.json({
    success: true,
    message: '订单出库成功',
    data: {
      order_no,
      status: ORDER_STATUS.SHIPPED,
      shipped_by,
      shipped_at: now,
      waybill_no: waybill_no || null
    }
  });
});

module.exports = router;
