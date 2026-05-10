const express = require('express');
const router = express.Router();
const refundService = require('../services/refundService');
const responseHandler = require('../utils/responseHandler');

function getOperator(req) {
  return req.headers['x-operator'] || 'system';
}

router.get('/', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      include_expired: req.query.include_expired === 'true'
    };
    const queue = refundService.getRefundQueue(filters);
    const pendingCount = refundService.getPendingRefundCount();
    res.json(responseHandler.success({
      queue,
      pending_count: pendingCount
    }));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

router.post('/enqueue/:orderId', (req, res) => {
  try {
    const { refund_method } = req.body;
    if (!refund_method) {
      return res.status(400).json(responseHandler.error('refund_method不能为空', 400));
    }
    
    const queueItem = refundService.addToRefundQueue(
      req.params.orderId,
      refund_method,
      getOperator(req)
    );
    res.json(responseHandler.success(queueItem, '加入退款队列成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/process/:queueId', (req, res) => {
  try {
    const simulateSuccess = req.body.simulate_success !== false;
    const result = refundService.processRefund(
      req.params.queueId,
      getOperator(req),
      simulateSuccess
    );
    res.json(responseHandler.success(result, result.success ? '退款成功' : '退款失败'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/retry/:queueId', (req, res) => {
  try {
    const queueItem = refundService.retryRefund(req.params.queueId, getOperator(req));
    res.json(responseHandler.success(queueItem, '退款重试已触发'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.post('/manual-process/:queueId', (req, res) => {
  try {
    const transactionNo = req.body.transaction_no;
    const result = refundService.manuallyProcessRefund(
      req.params.queueId,
      getOperator(req),
      transactionNo
    );
    res.json(responseHandler.success(result, '人工确认退款成功'));
  } catch (error) {
    res.status(400).json(responseHandler.error(error.message, 400));
  }
});

router.get('/order/:orderId', (req, res) => {
  try {
    const queueItem = refundService.getRefundQueueItemByOrderId(req.params.orderId);
    const records = refundService.getRefundRecordsByOrderId(req.params.orderId);
    res.json(responseHandler.success({
      queue: queueItem,
      records
    }));
  } catch (error) {
    res.status(500).json(responseHandler.error(error.message));
  }
});

module.exports = router;
