const express = require('express');
const { previewOrder, createOrder, partialRefund, fullRefund, getOrderDetail } = require('../services/orderService');
const router = express.Router();

router.post('/preview', (req, res) => {
  const { items, stream_id, platform_coupon_id, anchor_coupon_id, user_id } = req.body;
  
  if (!items || !stream_id || !user_id) {
    return res.status(400).json({ error: '商品列表、直播场次ID和用户ID必填' });
  }

  const result = previewOrder(items, stream_id, platform_coupon_id, anchor_coupon_id, user_id);
  
  if (result.error) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/confirm', (req, res) => {
  const { items, stream_id, platform_coupon_id, anchor_coupon_id, user_id } = req.body;
  
  if (!items || !stream_id || !user_id) {
    return res.status(400).json({ error: '商品列表、直播场次ID和用户ID必填' });
  }

  const result = createOrder(items, stream_id, platform_coupon_id, anchor_coupon_id, user_id);
  
  if (result.error) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/:order_no/refund/partial', (req, res) => {
  const { order_no } = req.params;
  const { refund_items } = req.body;
  
  if (!refund_items || !Array.isArray(refund_items)) {
    return res.status(400).json({ error: '退款商品列表必填' });
  }

  const result = partialRefund(order_no, refund_items);
  
  if (result.error) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.post('/:order_no/refund/full', (req, res) => {
  const { order_no } = req.params;
  const result = fullRefund(order_no);
  
  if (result.error) {
    return res.status(400).json(result);
  }
  
  res.json(result);
});

router.get('/:order_no', (req, res) => {
  const result = getOrderDetail(req.params.order_no);
  
  if (result.error) {
    return res.status(404).json(result);
  }
  
  res.json(result);
});

module.exports = router;
