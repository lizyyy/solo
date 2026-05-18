const express = require('express');
const router = express.Router();
const store = require('../storage/memoryStore');

router.get('/', (req, res) => {
  const { status, storeLocation } = req.query;
  const orders = store.getOrders({ status, storeLocation });
  res.json({
    code: 'SUCCESS',
    message: '查询成功',
    data: orders,
    total: orders.length
  });
});

router.get('/:id', (req, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    });
  }
  res.json({
    code: 'SUCCESS',
    message: '查询成功',
    data: order
  });
});

router.get('/:id/history', (req, res) => {
  const order = store.getOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    });
  }
  const histories = store.getHistories(req.params.id);
  res.json({
    code: 'SUCCESS',
    message: '查询成功',
    data: histories,
    total: histories.length
  });
});

router.patch('/:id', (req, res) => {
  const { operator, remarks, ...updates } = req.body;
  const order = store.updateOrder(req.params.id, updates, operator);
  
  if (!order) {
    return res.status(404).json({
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在'
    });
  }
  
  res.json({
    code: 'SUCCESS',
    message: '更新成功',
    data: order
  });
});

module.exports = router;
