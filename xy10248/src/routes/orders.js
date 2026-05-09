const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const db = require('../data/db');

router.post('/', (req, res) => {
  const { userId, deviceId, amount, washType, duration } = req.body;
  const result = orderService.createOrder({ userId, deviceId, amount, washType, duration });
  
  if (result.error) {
    return res.status(400).json(result);
  }
  res.status(201).json(result);
});

router.get('/', (req, res) => {
  const { userId } = req.query;
  const result = orderService.getAllOrders(userId);
  res.json(result);
});

router.get('/:orderNo', (req, res) => {
  const result = orderService.getOrderDetails(req.params.orderNo);
  
  if (result.error) {
    return res.status(404).json(result);
  }
  res.json(result);
});

router.post('/:orderNo/advance', (req, res) => {
  const { status, extra } = req.body;
  const result = orderService.advanceOrder(req.params.orderNo, status, extra || {});
  
  if (result.error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/:orderNo/progress', (req, res) => {
  const { steps } = req.body;
  const result = orderService.simulateWashProgress(req.params.orderNo, steps || [10, 25, 40]);
  
  if (result.error) {
    return res.status(400).json(result);
  }
  res.json(result);
});

module.exports = router;
