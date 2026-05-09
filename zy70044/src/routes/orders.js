const express = require('express');
const router = express.Router();
const repairOrderService = require('../services/repair-order-service');
const exportService = require('../services/export-service');
const { formatDate, AuditLog } = require('../utils');

router.get('/', (req, res) => {
  try {
    const filter = {
      status: req.query.status,
      product_sn: req.query.product_sn,
      current_responsibility: req.query.current_responsibility,
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0
    };
    const orders = repairOrderService.listOrders(filter);
    res.json({ success: true, data: orders });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const order = repairOrderService.createOrder(req.body, operator);
    res.status(201).json({ success: true, data: order });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/export', (req, res) => {
  try {
    const filter = {
      status: req.query.status,
      product_sn: req.query.product_sn,
      current_responsibility: req.query.current_responsibility,
      limit: 1000,
      offset: 0
    };
    const orders = repairOrderService.listOrders(filter);
    const csv = exportService.exportOrdersToCSV(orders);
    const filename = `返修单列表_${formatDate(Date.now()).replace(/[/:]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const order = repairOrderService.getOrder(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '返修单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.patch('/:id/status', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: '状态不能为空' });
    }
    const order = repairOrderService.updateOrderStatus(req.params.id, status, operator);
    res.json({ success: true, data: order });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const result = repairOrderService.deleteOrder(req.params.id, operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
