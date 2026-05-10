const express = require('express');
const router = express.Router();
const OrderService = require('../services/OrderService');

router.post('/', (req, res) => {
  try {
    const { projectId, amount, description } = req.body;
    const order = OrderService.createOrder({ projectId, amount, description });
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const order = OrderService.getOrder(req.params.id);
    res.json(order);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/:id/release', (req, res) => {
  try {
    const result = OrderService.releaseOrder(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/confirm', (req, res) => {
  try {
    const result = OrderService.confirmOrder(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
