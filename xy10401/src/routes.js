const express = require('express');
const router = express.Router();
const {
  createSubscription,
  registerPayment,
  submitRefundRequest,
  tryCalculateRefund,
  reviewRefundRequest,
  getReconciliation,
  getLogs
} = require('./services');

router.post('/subscriptions', (req, res) => {
  const { planId, userId, userName, agentId } = req.body;

  if (!planId || !userId || !userName || !agentId) {
    return res.status(400).json({
      error: 'MISSING_PARAMS',
      message: '缺少必要参数: planId, userId, userName, agentId'
    });
  }

  const result = createSubscription(planId, userId, userName, agentId);
  if (result.error) {
    return res.status(400).json(result);
  }

  res.status(201).json(result);
});

router.post('/payments', (req, res) => {
  const { subscriptionId, agentId, couponId, paymentDate } = req.body;

  if (!subscriptionId || !agentId) {
    return res.status(400).json({
      error: 'MISSING_PARAMS',
      message: '缺少必要参数: subscriptionId, agentId'
    });
  }

  const result = registerPayment(subscriptionId, agentId, couponId, paymentDate);
  if (result.error) {
    return res.status(400).json(result);
  }

  res.status(201).json(result);
});

router.post('/refunds/calculate', (req, res) => {
  const { orderId, refundDate, partialDays } = req.body;

  if (!orderId) {
    return res.status(400).json({
      error: 'MISSING_PARAMS',
      message: '缺少必要参数: orderId'
    });
  }

  const result = tryCalculateRefund(orderId, refundDate, partialDays);
  if (result.error) {
    return res.status(400).json(result);
  }

  res.json(result);
});

router.post('/refunds', (req, res) => {
  const { orderId, agentId, reason, refundDate, partialDays, idempotencyKey } = req.body;

  if (!orderId || !agentId || !reason) {
    return res.status(400).json({
      error: 'MISSING_PARAMS',
      message: '缺少必要参数: orderId, agentId, reason'
    });
  }

  const result = submitRefundRequest(orderId, agentId, reason, refundDate, partialDays, idempotencyKey);

  if (result.error) {
    return res.status(400).json(result);
  }

  if (result.isDuplicate) {
    return res.status(200).json(result);
  }

  res.status(201).json(result);
});

router.post('/refunds/:refundId/review', (req, res) => {
  const { refundId } = req.params;
  const { agentId, approved, supervisorNote } = req.body;

  if (!agentId || typeof approved !== 'boolean') {
    return res.status(400).json({
      error: 'MISSING_PARAMS',
      message: '缺少必要参数: agentId, approved'
    });
  }

  const result = reviewRefundRequest(refundId, agentId, approved, supervisorNote);
  if (result.error) {
    return res.status(400).json(result);
  }

  res.json(result);
});

router.get('/reconciliation', (req, res) => {
  const { date } = req.query;
  const result = getReconciliation(date);
  res.json(result);
});

router.get('/logs', (req, res) => {
  const { targetType, targetId } = req.query;
  const logs = getLogs(targetType, targetId);
  res.json({ logs });
});

const { PLANS, COUPONS, STORE, findSubscription, findOrder, findRefundRequest } = require('./models');

router.get('/plans', (req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

router.get('/coupons', (req, res) => {
  res.json({ coupons: Object.values(COUPONS) });
});

router.get('/agents', (req, res) => {
  res.json({ agents: STORE.agents });
});

router.get('/subscriptions/:id', (req, res) => {
  const subscription = findSubscription(req.params.id);
  if (!subscription) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '订阅不存在' });
  }
  res.json({ data: subscription });
});

router.get('/orders/:id', (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '订单不存在' });
  }
  res.json({ data: order });
});

router.get('/refunds/:id', (req, res) => {
  const refund = findRefundRequest(req.params.id);
  if (!refund) {
    return res.status(404).json({ error: 'NOT_FOUND', message: '退款申请不存在' });
  }
  res.json({ data: refund });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: '订阅客服退款 API', timestamp: new Date().toISOString() });
});

module.exports = router;
