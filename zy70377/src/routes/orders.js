const express = require('express');
const router = express.Router();
const OrderService = require('../services/OrderService');
const ETACalculatorService = require('../services/ETACalculatorService');
const Order = require('../models/Order');

router.post('/', async (req, res, next) => {
  try {
    const order = OrderService.createOrder(req.body);
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const orders = Order.getAll();
    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:orderId', async (req, res, next) => {
  try {
    const order = Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:orderId/eta', async (req, res, next) => {
  try {
    const etaInfo = ETACalculatorService.getEtaWithExplanation(req.params.orderId);
    res.status(200).json({
      success: true,
      data: etaInfo
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:orderId/track', async (req, res, next) => {
  try {
    const result = OrderService.submitTrackPoint(req.params.orderId, req.body);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:orderId/delay', async (req, res, next) => {
  try {
    const result = OrderService.reportDelay(req.params.orderId, req.body);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:orderId/reassign', async (req, res, next) => {
  try {
    const result = OrderService.reassignRider(req.params.orderId, req.body);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:orderId/sign', async (req, res, next) => {
  try {
    const result = OrderService.signOrder(req.params.orderId, req.body);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:orderId/priority', async (req, res, next) => {
  try {
    const result = OrderService.updateOrderPriority(req.params.orderId, req.body);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/delays/:delayId/resolve', async (req, res, next) => {
  try {
    const result = OrderService.resolveDelay(req.params.delayId);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
