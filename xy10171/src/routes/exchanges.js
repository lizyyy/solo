const express = require('express');
const { ERROR_CODES, ERROR_MESSAGES } = require('../constants/errorCodes');
const { idempotencyMiddleware } = require('../services/idempotency');
const exchangeService = require('../services/exchangeService');
const inventoryService = require('../services/inventory');
const stateMachine = require('../services/stateMachine');

const router = express.Router();

function successResponse(data, message = 'Success') {
  return { code: 0, message, data };
}

function errorResponse(code, message, data = null) {
  return { code, message: message || ERROR_MESSAGES[code] || 'Unknown error', data };
}

router.post('/', idempotencyMiddleware('exchange'), (req, res) => {
  try {
    const exchange = exchangeService.createExchange(req.body);
    const response = successResponse(exchange, '换货单创建成功');
    res.saveIdempotentResponse(exchange.id, response);
    res.status(201).json(response);
  } catch (err) {
    res.status(400).json(errorResponse(ERROR_CODES.INVALID_REQUEST_DATA, err.message));
  }
});

router.get('/', (req, res) => {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.order_id) filters.order_id = req.query.order_id;
  
  const exchanges = exchangeService.listExchanges(filters);
  res.json(successResponse(exchanges));
});

router.get('/stats', (req, res) => {
  const stats = exchangeService.getExchangeStats();
  const inventoryStats = inventoryService.getInventoryStats();
  res.json(successResponse({
    exchanges: stats,
    inventory: inventoryStats
  }, '统计数据'));
});

router.get('/:id', (req, res) => {
  const exchange = exchangeService.getExchangeWithLogs(req.params.id);
  if (!exchange) {
    return res.status(404).json(errorResponse(ERROR_CODES.EXCHANGE_NOT_FOUND));
  }
  
  const nextAllowed = stateMachine.getNextAllowedStatuses(exchange.status);
  res.json(successResponse({
    ...exchange,
    next_allowed_statuses: nextAllowed
  }));
});

router.post('/:id/submit', idempotencyMiddleware('exchange_action'), (req, res) => {
  try {
    const exchange = exchangeService.submitApply(req.params.id);
    const response = successResponse(exchange, '已提交换货申请');
    res.saveIdempotentResponse(exchange.id, response);
    res.json(response);
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:id/ship-back', idempotencyMiddleware('exchange_action'), (req, res) => {
  try {
    const exchange = exchangeService.shipBack(req.params.id);
    const response = successResponse(exchange, '商品已寄回');
    res.saveIdempotentResponse(exchange.id, response);
    res.json(response);
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:id/qc-pass', idempotencyMiddleware('exchange_action'), (req, res) => {
  try {
    const exchange = exchangeService.passQC(req.params.id);
    const response = successResponse(exchange, '质检通过');
    res.saveIdempotentResponse(exchange.id, response);
    res.json(response);
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:id/qc-fail', idempotencyMiddleware('exchange_action'), (req, res) => {
  try {
    const exchange = exchangeService.failQC(req.params.id);
    const response = successResponse(exchange, '质检不通过');
    res.saveIdempotentResponse(exchange.id, response);
    res.json(response);
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:id/calculate-price', idempotencyMiddleware('exchange_action'), (req, res) => {
  try {
    const { price_diff } = req.body;
    if (typeof price_diff !== 'number') {
      return res.status(400).json(errorResponse(ERROR_CODES.INVALID_REQUEST_DATA, 'price_diff 必须是数字'));
    }
    const exchange = exchangeService.calculatePriceDiff(req.params.id, price_diff);
    const response = successResponse(exchange, '差价计算完成');
    res.saveIdempotentResponse(exchange.id, response);
    res.json(response);
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:id/pay', idempotencyMiddleware('exchange_action'), (req, res) => {
  try {
    const { paid_amount } = req.body;
    if (typeof paid_amount !== 'number') {
      return res.status(400).json(errorResponse(ERROR_CODES.INVALID_REQUEST_DATA, 'paid_amount 必须是数字'));
    }
    const exchange = exchangeService.payDiff(req.params.id, paid_amount);
    const response = successResponse(exchange, '支付成功');
    res.saveIdempotentResponse(exchange.id, response);
    res.json(response);
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:id/reship', idempotencyMiddleware('exchange_action'), (req, res) => {
  try {
    const exchange = exchangeService.startReshipping(req.params.id);
    const response = successResponse(exchange, '已开始重发商品');
    res.saveIdempotentResponse(exchange.id, response);
    res.json(response);
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:id/complete', idempotencyMiddleware('exchange_action'), (req, res) => {
  try {
    const exchange = exchangeService.complete(req.params.id);
    const response = successResponse(exchange, '换货完成');
    res.saveIdempotentResponse(exchange.id, response);
    res.json(response);
  } catch (err) {
    handleError(err, res);
  }
});

router.post('/:id/cancel', idempotencyMiddleware('exchange_action'), (req, res) => {
  try {
    const exchange = exchangeService.cancel(req.params.id);
    const response = successResponse(exchange, '已取消换货');
    res.saveIdempotentResponse(exchange.id, response);
    res.json(response);
  } catch (err) {
    handleError(err, res);
  }
});

function handleError(err, res) {
  if (err.code === ERROR_CODES.INVALID_STATE_TRANSITION) {
    res.status(400).json(errorResponse(err.code, err.message));
  } else if (err.code === ERROR_CODES.EXCHANGE_NOT_FOUND) {
    res.status(404).json(errorResponse(err.code, err.message));
  } else if (err.code === ERROR_CODES.PAYMENT_AMOUNT_MISMATCH) {
    res.status(400).json(errorResponse(err.code, err.message));
  } else if (err.code === ERROR_CODES.INSUFFICIENT_INVENTORY) {
    res.status(400).json(errorResponse(err.code, err.message));
  } else {
    res.status(500).json(errorResponse(ERROR_CODES.INTERNAL_SERVER_ERROR, err.message));
  }
}

module.exports = router;
