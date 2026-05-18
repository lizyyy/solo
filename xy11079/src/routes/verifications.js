const express = require('express');
const router = express.Router();
const store = require('../storage/memoryStore');

const ERROR_CODES = {
  PROXY_IDCARD_INVALID: 'PROXY_IDCARD_INVALID',
  ORDER_ALREADY_VERIFIED: 'ORDER_ALREADY_VERIFIED',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  VERIFICATION_CODE_INVALID: 'VERIFICATION_CODE_INVALID',
  BALANCE_NOT_PAID: 'BALANCE_NOT_PAID',
  LOG_INCONSISTENT: 'LOG_INCONSISTENT',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED'
};

function validateIdCard(idCard) {
  if (!idCard || idCard.length !== 18) return false;
  const regex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  return regex.test(idCard);
}

function checkLogConsistency(orderId) {
  const verifications = store.getVerifications({ orderId });
  const histories = store.getHistories(orderId);
  
  const successVerifications = verifications.filter(v => v.status === 'success');
  const completedHistories = histories.filter(h => h.newValue === 'completed');
  
  return successVerifications.length === completedHistories.length;
}

router.post('/', (req, res) => {
  const {
    orderNo,
    verificationCode,
    verificationType,
    proxyPicker,
    proxyIdCard,
    proxyPhone,
    balancePaid,
    paymentMethod,
    operator,
    operatorId
  } = req.body;

  const order = store.getOrderByOrderNo(orderNo);
  
  if (!order) {
    return res.status(404).json({
      code: ERROR_CODES.ORDER_NOT_FOUND,
      message: '订单不存在'
    });
  }

  if (order.status === 'completed') {
    return res.status(400).json({
      code: ERROR_CODES.ORDER_ALREADY_VERIFIED,
      message: '该订单已被核销，请勿重复操作',
      data: { orderId: order.id, currentStatus: order.status }
    });
  }

  if (order.verificationCode !== verificationCode) {
    return res.status(400).json({
      code: ERROR_CODES.VERIFICATION_CODE_INVALID,
      message: '验证码错误'
    });
  }

  let errorCode = null;
  let errorMessage = null;
  let finalStatus = 'success';

  if (verificationType === 'proxy') {
    if (!validateIdCard(proxyIdCard)) {
      errorCode = ERROR_CODES.PROXY_IDCARD_INVALID;
      errorMessage = '代取人身份证号格式无效，进入人工审核';
      finalStatus = 'manual_review';
    }
  }

  if (balancePaid < order.balance) {
    errorCode = ERROR_CODES.BALANCE_NOT_PAID;
    errorMessage = '尾款未付清，无法完成取货';
    finalStatus = 'failed';
  }

  const verification = store.createVerification({
    orderId: order.id,
    orderNo,
    operator,
    operatorId,
    verificationType,
    proxyPicker,
    proxyIdCard,
    proxyPhone,
    verificationCode,
    status: finalStatus,
    errorCode,
    errorMessage,
    balancePaid,
    paymentMethod
  });

  if (finalStatus === 'success') {
    store.updateOrder(order.id, {
      status: 'completed',
      actualPickupTime: new Date().toISOString(),
      proxyPicker,
      proxyIdCard,
      proxyPhone
    }, operator);
  } else if (finalStatus === 'manual_review') {
    store.updateOrder(order.id, {
      status: 'manual_review',
      proxyPicker,
      proxyIdCard,
      proxyPhone
    }, operator);
  }

  if (finalStatus === 'success') {
    res.json({
      code: 'SUCCESS',
      message: '取货核验成功',
      data: verification
    });
  } else {
    res.status(400).json({
      code: errorCode,
      message: errorMessage,
      data: verification
    });
  }
});

router.get('/', (req, res) => {
  const { orderId, status } = req.query;
  const verifications = store.getVerifications({ orderId, status });
  res.json({
    code: 'SUCCESS',
    message: '查询成功',
    data: verifications,
    total: verifications.length
  });
});

router.post('/:orderId/resubmit', (req, res) => {
  const { operator, remarks, approve } = req.body;
  const order = store.getOrderById(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      code: ERROR_CODES.ORDER_NOT_FOUND,
      message: '订单不存在'
    });
  }

  if (order.status !== 'manual_review') {
    return res.status(400).json({
      code: 'INVALID_STATUS',
      message: '该订单不在人工审核状态'
    });
  }

  store.addHistory(
    req.params.orderId,
    'manual_remarks',
    null,
    remarks,
    operator,
    `人工审核备注: ${remarks}`
  );

  if (approve) {
    store.updateOrder(req.params.orderId, {
      status: 'completed',
      actualPickupTime: new Date().toISOString()
    }, operator);

    store.createVerification({
      orderId: order.id,
      orderNo: order.orderNo,
      operator,
      operatorId: operator,
      verificationType: 'manual_approved',
      status: 'success',
      remarks: remarks
    });

    res.json({
      code: 'SUCCESS',
      message: '人工审核通过，订单已完成',
      data: order
    });
  } else {
    store.updateOrder(req.params.orderId, {
      status: 'pending'
    }, operator);

    res.json({
      code: 'SUCCESS',
      message: '人工审核退回，订单恢复待取货状态',
      data: order
    });
  }
});

router.post('/:orderId/withdraw', (req, res) => {
  const { operator, remarks } = req.body;
  const order = store.getOrderById(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      code: ERROR_CODES.ORDER_NOT_FOUND,
      message: '订单不存在'
    });
  }

  if (order.status !== 'completed') {
    return res.status(400).json({
      code: 'INVALID_STATUS',
      message: '只有已完成的订单才能撤回'
    });
  }

  store.updateOrder(req.params.orderId, {
    status: 'pending',
    actualPickupTime: null
  }, operator);

  store.addHistory(
    req.params.orderId,
    'status',
    'completed',
    'pending',
    operator,
    `订单撤回: ${remarks || '无备注'}`
  );

  res.json({
    code: 'SUCCESS',
    message: '订单已撤回，恢复待取货状态',
    data: order
  });
});

router.get('/log-consistency/:orderId', (req, res) => {
  const isConsistent = checkLogConsistency(req.params.orderId);
  res.json({
    code: 'SUCCESS',
    message: isConsistent ? '日志一致' : '日志不一致',
    data: {
      orderId: req.params.orderId,
      isConsistent
    }
  });
});

module.exports = router;
