const express = require('express');
const router = express.Router();
const orderService = require('../services/orderService');
const { BusinessError } = require('../utils/helpers');

router.post('/calculate', async (req, res) => {
  try {
    const { userId, courseId, couponId, groupBuyId } = req.body;
    
    if (!userId || !courseId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填参数：userId, courseId',
        code: 'MISSING_PARAMS'
      });
    }
    
    const result = await orderService.calculateOrderPrice(userId, courseId, {
      couponId,
      groupBuyId,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/create', async (req, res) => {
  try {
    const { userId, courseId, couponId, groupBuyId, operatorId, operatorName } = req.body;
    
    if (!userId || !courseId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必填参数：userId, courseId',
        code: 'MISSING_PARAMS'
      });
    }
    
    const result = await orderService.createOrder(userId, courseId, {
      couponId,
      groupBuyId,
      operatorId,
      operatorName,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:orderId/lock-price', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { lockDurationMinutes, operatorId, operatorName } = req.body;
    
    const result = await orderService.lockOrderPrice(orderId, {
      lockDurationMinutes,
      operatorId,
      operatorName,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:orderId/payment', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { amount, paymentMethod, callbackId, callbackData, operatorId, operatorName } = req.body;
    
    const result = await orderService.processPayment(orderId, {
      amount,
      paymentMethod,
      callbackId,
      callbackData,
      operatorId,
      operatorName,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:orderId/payment/callback', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { callbackId, callbackData, amount, paymentMethod } = req.body;
    
    if (!callbackId) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少回调ID',
        code: 'MISSING_CALLBACK_ID'
      });
    }
    
    const result = await orderService.processPayment(orderId, {
      amount,
      paymentMethod,
      callbackId,
      callbackData,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:orderId/refund', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { refundAmount, refundReason, refundType, returnCoupon, operatorId, operatorName } = req.body;
    
    const result = await orderService.processRefund(orderId, {
      refundAmount,
      refundReason,
      refundType,
      returnCoupon,
      operatorId,
      operatorName,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/:orderId/adjust', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { newFinalPrice, changeReason, operatorId, operatorName } = req.body;
    
    const result = await orderService.manuallyAdjustOrder(orderId, {
      newFinalPrice,
      changeReason,
      operatorId,
      operatorName,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    let order = await orderService.getOrderById(orderId);
    if (!order) {
      order = await orderService.getOrderByNo(orderId);
    }
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        error: '订单不存在',
        code: 'ORDER_NOT_FOUND'
      });
    }
    
    const enrichedOrder = await orderService.getOrderById(order.id);
    
    res.json({
      success: true,
      data: enrichedOrder,
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, userId } = req.query;
    
    const orders = await orderService.getAllOrders({
      status,
      userId,
    });
    
    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    handleError(res, error);
  }
});

function handleError(res, error) {
  console.error('API Error:', error);
  
  if (error instanceof BusinessError) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: error.code,
      details: error.details,
    });
  } else {
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      code: 'INTERNAL_ERROR',
      message: error.message,
    });
  }
}

module.exports = router;
