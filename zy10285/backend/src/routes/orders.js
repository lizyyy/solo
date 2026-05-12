const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');

router.get('/', (req, res) => {
  orderService.getOrders(req.query, (err, orders) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json({ success: true, data: orders });
  });
});

router.get('/:id', (req, res) => {
  orderService.getOrderDetail(req.params.id, (err, order) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!order) return res.status(404).json({ success: false, message: '订单不存在' });
    res.json({ success: true, data: order });
  });
});

router.post('/', (req, res) => {
  orderService.createOrder(req.body, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json(result);
  });
});

router.post('/:id/confirm', (req, res) => {
  orderService.confirmOrder(req.params.id, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json(result);
  });
});

router.post('/:id/dispatch', (req, res) => {
  orderService.dispatchOrder(req.params.id, req.body.cooler_id, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json(result);
  });
});

router.post('/:id/sign', (req, res) => {
  orderService.signOrder(req.params.id, req.body.signed_by, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json(result);
  });
});

router.post('/:id/refund', (req, res) => {
  orderService.refundOrder(req.params.id, req.body.reason, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    res.json(result);
  });
});

router.post('/check-capacity', (req, res) => {
  orderService.checkCapacity(
    req.body.delivery_slot_id,
    req.body.quantity,
    req.body.ice_spec_id,
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.message });
      res.json({ success: true, data: result });
    });
});

module.exports = router;
