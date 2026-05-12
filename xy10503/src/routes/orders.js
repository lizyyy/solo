const express = require('express');
const router = express.Router();
const core = require('../services/core');

router.post('/', (req, res) => {
  try {
    const idempotentKey = req.headers['x-idempotent-key'];
    const operator = req.headers['x-operator'] || 'system';

    if (idempotentKey) {
      const result = core.withIdempotency(idempotentKey, () => {
        return core.createOrder({ ...req.body, operator });
      });
      return res.json({
        success: true,
        is_idempotent: result.isIdempotent,
        data: result.data
      });
    }

    const order = core.createOrder({ ...req.body, operator });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const orders = core.listOrders(req.query);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/no/:orderNo', (req, res) => {
  try {
    const order = core.getOrderByNo(req.params.orderNo);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:orderId', (req, res) => {
  try {
    const order = core.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/:orderId/status', (req, res) => {
  try {
    const { status, remark } = req.body;
    const operator = req.headers['x-operator'] || 'system';
    const order = core.updateOrderStatus(req.params.orderId, status, operator, remark);
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:orderId/correct', (req, res) => {
  try {
    const { old_status, new_status, reason } = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!reason) {
      return res.status(400).json({ success: false, error: '必须提供修正原因' });
    }

    const order = core.correctOrderStatus(
      req.params.orderId,
      old_status,
      new_status,
      reason,
      operator
    );
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/:orderId/hierarchy', (req, res) => {
  try {
    const report = core.generateOrderHierarchyReport(req.params.orderId);
    if (!report) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
