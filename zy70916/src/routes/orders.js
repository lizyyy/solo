const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const queryService = require('../services/queryService');

router.get('/', (req, res) => {
  try {
    const orders = orderService.listOrders(req.query);
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const order = orderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: '服务单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = queryService.getOrderTrackHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/assign', (req, res) => {
  try {
    const { nurse_id, handled_by } = req.body;
    if (!nurse_id || !handled_by) {
      return res.status(400).json({ error: '护士ID和处理人不能为空' });
    }
    const order = orderService.assignNurse(req.params.id, nurse_id, handled_by);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/process', (req, res) => {
  try {
    const { handled_by, reason } = req.body;
    if (!handled_by) {
      return res.status(400).json({ error: '处理人不能为空' });
    }
    const order = orderService.processOrder(req.params.id, handled_by, reason);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/approve', (req, res) => {
  try {
    const { handled_by, reason } = req.body;
    if (!handled_by) {
      return res.status(400).json({ error: '处理人不能为空' });
    }
    const order = orderService.approveOrder(req.params.id, handled_by, reason);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/return', (req, res) => {
  try {
    const { handled_by, reason } = req.body;
    if (!handled_by || !reason) {
      return res.status(400).json({ error: '处理人和原因不能为空' });
    }
    const order = orderService.returnOrder(req.params.id, handled_by, reason);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/cancel', (req, res) => {
  try {
    const { handled_by, reason } = req.body;
    if (!handled_by || !reason) {
      return res.status(400).json({ error: '处理人和原因不能为空' });
    }
    const order = orderService.cancelOrder(req.params.id, handled_by, reason);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/replace', (req, res) => {
  try {
    const { new_nurse_id, handled_by, reason } = req.body;
    if (!new_nurse_id || !handled_by || !reason) {
      return res.status(400).json({ error: '新护士ID、处理人和原因不能为空' });
    }
    const order = orderService.replaceNurse(req.params.id, new_nurse_id, handled_by, reason);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/complete', (req, res) => {
  try {
    const { handled_by, reason } = req.body;
    if (!handled_by) {
      return res.status(400).json({ error: '处理人不能为空' });
    }
    const order = orderService.completeOrder(req.params.id, handled_by, reason);
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
