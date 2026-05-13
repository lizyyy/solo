const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const exportService = require('../services/exportService');
const demoService = require('../services/demoService');

router.get('/', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      device_queue: req.query.device_queue,
      paper_size: req.query.paper_size,
      binding_type: req.query.binding_type,
      order_no: req.query.order_no
    };
    const orders = await orderService.getOrders(filters);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/constants', (req, res) => {
  res.json({
    paper_sizes: orderService.PAPER_SIZES,
    binding_types: orderService.BINDING_TYPES,
    device_queues: orderService.DEVICE_QUEUES,
    statuses: orderService.STATUSES
  });
});

router.get('/:id', async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const timeline = await orderService.getTimeline(req.params.id);
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const result = await orderService.createOrder(req.body, idempotencyKey);
    res.status(result.isDuplicate ? 200 : 201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/binding', async (req, res) => {
  try {
    const { binding_type, operator } = req.body;
    const order = await orderService.updateBindingType(
      req.params.id,
      binding_type,
      operator || 'system'
    );
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/device-queue', async (req, res) => {
  try {
    const { device_queue, reason, operator } = req.body;
    const order = await orderService.updateDeviceQueue(
      req.params.id,
      device_queue,
      reason,
      operator || 'system'
    );
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/pickup-promise', async (req, res) => {
  try {
    const { pickup_promise, operator } = req.body;
    const order = await orderService.reviewPickupPromise(
      req.params.id,
      pickup_promise,
      operator || 'system'
    );
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { status, reason, operator } = req.body;
    const order = await orderService.updateOrderStatus(
      req.params.id,
      status,
      reason,
      operator || 'system'
    );
    res.json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/bulk-import', async (req, res) => {
  try {
    const { orders, operator } = req.body;
    if (!Array.isArray(orders)) {
      return res.status(400).json({ error: 'orders 必须是数组' });
    }
    const results = await orderService.bulkImportOrders(orders, operator || 'system');
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      device_queue: req.query.device_queue,
      paper_size: req.query.paper_size,
      binding_type: req.query.binding_type,
      order_no: req.query.order_no
    };
    const csv = await exportService.exportOrdersToCSV(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/timeline/export/csv', async (req, res) => {
  try {
    const csv = await exportService.exportTimelineToCSV(req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=timeline_${req.params.id}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/demo/success', async (req, res) => {
  try {
    const order = await demoService.runSuccessPath();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/demo/blocked', async (req, res) => {
  try {
    const order = await demoService.runBlockedPath();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/demo/manual-correction', async (req, res) => {
  try {
    const order = await demoService.runManualCorrectionPath();
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/demo/duplicate', async (req, res) => {
  try {
    const result = await demoService.runDuplicateSubmissionPath();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/demo/all', async (req, res) => {
  try {
    const results = await demoService.runAllDemos();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
