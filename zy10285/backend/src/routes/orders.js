const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');

router.get('/', (req, res) => {
  try {
    const orders = orderService.getOrders(req.query);
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const order = orderService.getOrderDetail(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const result = orderService.createOrder(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/confirm', (req, res) => {
  try {
    const result = orderService.confirmOrder(req.params.id, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/dispatch', (req, res) => {
  try {
    const result = orderService.dispatchOrder(req.params.id, req.body.cooler_id, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/sign', (req, res) => {
  try {
    const result = orderService.signOrder(req.params.id, req.body.signed_by, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/refund', (req, res) => {
  try {
    const result = orderService.refundOrder(req.params.id, req.body.reason, req.body.operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/check-capacity', (req, res) => {
  try {
    const result = orderService.checkCapacity(
      req.body.delivery_slot_id,
      req.body.quantity,
      req.body.ice_spec_id
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
