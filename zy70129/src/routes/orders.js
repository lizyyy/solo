const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const responseHandler = require('../utils/responseHandler');
const idempotency = require('../utils/idempotency');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.get('/', (req, res) => {
  try {
    const filters = {
      venue_id: req.query.venue_id,
      status: req.query.status,
      customer_name: req.query.customer_name,
      order_no: req.query.order_no,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    
    const orders = orderService.getOrders(filters);
    res.json(responseHandler.success(orders));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

router.post('/', (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  
  if (idempotencyKey) {
    const check = idempotency.checkIdempotency(idempotencyKey, req.body);
    if (check.exists) {
      return res.json(check.response);
    }
  }

  try {
    const order = orderService.createOrder(req.body, getOperator(req));
    const response = responseHandler.success(order, '订单创建成功');
    
    if (idempotencyKey) {
      idempotency.storeResponse(idempotencyKey, response);
    }
    
    res.status(201).json(response);
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.get('/:orderId', (req, res) => {
  try {
    const order = orderService.getOrderWithDetails(req.params.orderId);
    if (!order) {
      return res.status(404).json(responseHandler.notFound('订单不存在'));
    }
    res.json(responseHandler.success(order));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

router.put('/:orderId', (req, res) => {
  try {
    const order = orderService.updateOrder(req.params.orderId, req.body, getOperator(req));
    res.json(responseHandler.success(order, '订单更新成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/:orderId/start-using', (req, res) => {
  try {
    const order = orderService.startUsing(req.params.orderId, getOperator(req));
    res.json(responseHandler.success(order, '开始使用'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/:orderId/start-checking', (req, res) => {
  try {
    const order = orderService.startChecking(req.params.orderId, getOperator(req));
    res.json(responseHandler.success(order, '开始验收'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/:orderId/cancel', (req, res) => {
  try {
    const reason = req.body.reason;
    if (!reason) {
      return res.status(400).json(responseHandler.error('取消订单必须提供原因', 400));
    }
    const order = orderService.cancelOrder(req.params.orderId, getOperator(req), reason);
    res.json(responseHandler.success(order, '订单已取消'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

module.exports = router;
