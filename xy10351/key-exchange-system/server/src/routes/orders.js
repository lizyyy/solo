const express = require('express');
const OrderService = require('../services/OrderService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const orders = await OrderService.getAllOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await OrderService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const operator = { name: req.body.operator || '系统', role: 'admin' };
    const order = await OrderService.createOrder(req.body.orderData, operator);
    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const operator = { name: req.body.operator || '系统', role: 'admin' };
    const order = await OrderService.updateOrder(req.params.id, req.body.orderData, operator);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/available/list', async (req, res) => {
  try {
    const orders = await OrderService.getAvailableOrders();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/cleaner/:name', async (req, res) => {
  try {
    const orders = await OrderService.getOrdersByCleaner(req.params.name);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
