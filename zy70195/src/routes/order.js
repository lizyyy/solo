const express = require('express');
const router = express.Router();
const orderService = require('../services/order-service');

router.post('/', async (req, res) => {
  try {
    const order = await orderService.createOrder(req.body);
    res.status(201).json({ 
      success: true, 
      data: order,
      message: order.status === 'blocked' ? '订单已被拦截' : '订单创建成功'
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const orders = await orderService.getAllOrders();
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/supplier/:supplierId', async (req, res) => {
  try {
    const orders = await orderService.getOrdersBySupplier(req.params.supplierId);
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const order = await orderService.approveOrder(req.params.id, req.body.approved_by || '系统');
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const order = await orderService.rejectOrder(
      req.params.id, 
      req.body.reason || '未通过审批',
      req.body.rejected_by || '系统'
    );
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
