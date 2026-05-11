const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const outboundService = require('../services/outboundService');

const router = express.Router();

router.use(authenticateToken);

router.post('/orders', (req, res) => {
  try {
    const { orderNo, items } = req.body;
    if (!orderNo) {
      return res.status(400).json({ error: 'orderNo is required' });
    }

    const order = outboundService.createOrder(req.user.id, orderNo, items || []);
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders/:orderId/items', (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const order = outboundService.importItems(req.params.orderId, req.user.id, items);
    res.json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/orders', (req, res) => {
  try {
    const { status } = req.query;
    const orders = outboundService.listOrders(status);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders/:orderId', (req, res) => {
  try {
    const progress = outboundService.getOrderProgress(req.params.orderId);
    if (!progress) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(progress);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders/:orderId/scan', (req, res) => {
  try {
    const { barcode } = req.body;
    if (!barcode) {
      return res.status(400).json({ error: 'barcode is required' });
    }

    const result = outboundService.scanItem(req.params.orderId, req.user.id, barcode);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders/:orderId/confirm', (req, res) => {
  try {
    const result = outboundService.confirmOutbound(req.params.orderId, req.user.id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/orders/:orderId/cancel', (req, res) => {
  try {
    const { reason } = req.body;
    const result = outboundService.cancelOrder(req.params.orderId, req.user.id, reason);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/stats/checker-errors', (req, res) => {
  try {
    const stats = outboundService.getCheckerErrorStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats/checker-errors/:checkerId', (req, res) => {
  try {
    const details = outboundService.getCheckerErrorDetails(req.params.checkerId);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
