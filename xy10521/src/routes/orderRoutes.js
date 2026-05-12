const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const depositService = require('../services/depositService');
const auditService = require('../services/auditService');

router.post('/orders', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const idempotencyKey = req.headers['x-idempotency-key'];
    const result = await orderService.createRentalOrder(req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const result = await orderService.listOrders(req.query);
    res.json({ success: true, data: result, count: result.length });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/orders/:orderId', async (req, res) => {
  try {
    const result = await orderService.getOrder(req.params.orderId);
    if (!result) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/orders/:orderId/detail', async (req, res) => {
  try {
    const result = await orderService.getOrderDetail(req.params.orderId);
    if (!result) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/orders/:orderId/freeze-deposit', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey;
    const result = await orderService.freezeDeposit(req.params.orderId, idempotencyKey, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/orders/:orderId/renew', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await orderService.renewOrder(req.params.orderId, req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/orders/:orderId/return', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await orderService.returnEquipment(req.params.orderId, req.body, operator);
    res.json({ success: result.success !== false, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/orders/:orderId/assess-damage', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await orderService.assessDamage(req.params.orderId, req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/orders/:orderId/refund', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await orderService.processRefund(req.params.orderId, req.body, operator);
    res.json({ success: result.success, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/refund-callback', async (req, res) => {
  try {
    const result = await orderService.handleRefundCallback(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/orders/:orderId/manual-adjust', async (req, res) => {
  try {
    const operator = req.headers['x-operator'];
    if (!operator) {
      return res.status(400).json({ success: false, error: '必须指定操作者 (x-operator header)' });
    }
    const result = await orderService.manualAdjust(req.params.orderId, req.body, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/orders/:orderId/ledger', async (req, res) => {
  try {
    const result = await depositService.getDepositLedger(req.params.orderId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/orders/:orderId/fees', async (req, res) => {
  try {
    const result = await depositService.getFeeDetailsByOrder(req.params.orderId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/orders/:orderId/timeline', async (req, res) => {
  try {
    const result = await auditService.getEntityTimeline('ORDER', req.params.orderId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;