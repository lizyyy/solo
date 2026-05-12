const express = require('express');
const OrderService = require('../services/orderService');
const InventoryService = require('../services/inventoryService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, activityId, status, paymentStatus, orderNo, userName } = req.query;
    const result = await OrderService.getOrders(
      { activityId, status, paymentStatus, orderNo, userName },
      parseInt(page),
      parseInt(pageSize)
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await OrderService.getOrderDetail(req.params.id);
    if (!order) {
      return res.json({ success: false, message: '订单不存在' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { activityId, productId, userId, userName, userPhone, quantity } = req.body;
    const result = await OrderService.createOrder(activityId, productId, userId, userName, userPhone, quantity || 1);
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/:id/payment-callback', async (req, res) => {
  try {
    const { transactionId, success } = req.body;
    const result = await OrderService.processPaymentCallback(req.params.id, transactionId, success);
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/:id/timeout', async (req, res) => {
  try {
    const result = await OrderService.processTimeoutOrder(req.params.id);
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/:id/compensation', async (req, res) => {
  try {
    const { applicantId, applicantName, applyReason } = req.body;
    const result = await OrderService.applyCompensation(req.params.id, applicantId, applicantName, applyReason);
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/compensation/:applicationId/approve', async (req, res) => {
  try {
    const { reviewerId, reviewerName, reviewRemark } = req.body;
    const result = await OrderService.approveCompensation(req.params.applicationId, reviewerId, reviewerName, reviewRemark);
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/compensation/:applicationId/reject', async (req, res) => {
  try {
    const { reviewerId, reviewerName, rejectReason } = req.body;
    const result = await OrderService.rejectCompensation(req.params.applicationId, reviewerId, reviewerName, rejectReason);
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/:id/ship', async (req, res) => {
  try {
    const { trackingNo, operatorId, operatorName } = req.body;
    const result = await OrderService.shipOrder(req.params.id, trackingNo, operatorId, operatorName);
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.post('/:id/refund', async (req, res) => {
  try {
    const { refundAmount, operatorId, operatorName, returnStock } = req.body;
    const result = await OrderService.processRefund(req.params.id, refundAmount, operatorId, operatorName, returnStock !== false);
    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

router.get('/inventory/logs', async (req, res) => {
  try {
    const { productId, limit = 100 } = req.query;
    let logs;
    if (productId) {
      logs = await InventoryService.getInventoryLogs(productId, parseInt(limit));
    } else {
      logs = await InventoryService.getAllLogs(parseInt(limit));
    }
    res.json({ success: true, data: logs });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

module.exports = router;
