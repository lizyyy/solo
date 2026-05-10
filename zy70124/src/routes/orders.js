const express = require('express');
const router = express.Router();
const { createOrder, payOrder, refundOrder, getOrder, listOrders } = require('../services/order');
const { getQueueStatus, removeFromQueue } = require('../services/queue');

router.post('/', (req, res) => {
  const { tierId, accountId, idCardNo, paymentChannel, quantity, holders } = req.body;

  if (!tierId || !accountId || !idCardNo || !paymentChannel || !quantity) {
    return res.status(400).json({
      success: false,
      message: '票档ID、账号ID、证件号、支付渠道、购票数量必填'
    });
  }

  const result = createOrder({
    tierId,
    accountId,
    idCardNo,
    paymentChannel,
    quantity: parseInt(quantity),
    ip: req.ip,
    holders
  });

  if (result.success) {
    res.json(result);
  } else {
    const status = result.code === 'OUT_OF_STOCK' ? 200 : 400;
    res.status(status).json(result);
  }
});

router.post('/:orderId/pay', (req, res) => {
  const result = payOrder(req.params.orderId);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/:orderId/refund', (req, res) => {
  const { reason } = req.body;
  const result = refundOrder(req.params.orderId, reason || '用户申请退票');
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.get('/:orderId', (req, res) => {
  const order = getOrder(req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: '订单不存在' });
  }
  res.json({ success: true, data: order });
});

router.get('/', (req, res) => {
  const { accountId } = req.query;
  const orders = listOrders(accountId || null);
  res.json({ success: true, data: orders });
});

router.get('/queue/:queueId', (req, res) => {
  const status = getQueueStatus(req.params.queueId);
  if (!status) {
    return res.status(404).json({ success: false, message: '候补记录不存在' });
  }
  res.json({ success: true, data: status });
});

router.delete('/queue/:queueId', (req, res) => {
  const success = removeFromQueue(req.params.queueId);
  if (success) {
    res.json({ success: true, message: '已取消候补' });
  } else {
    res.status(400).json({ success: false, message: '无法取消：可能已匹配或已取消' });
  }
});

module.exports = router;
