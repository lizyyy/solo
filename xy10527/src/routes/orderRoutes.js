const express = require('express');
const orderService = require('../services/OrderService');
const logger = require('../utils/logger');

const router = express.Router();

router.post('/', (req, res) => {
  try {
    const order = orderService.createOrder(req.body);
    res.json({
      success: true,
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        items: order.items
      }
    });
  } catch (error) {
    logger.error('创建订单失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:orderId', (req, res) => {
  const order = orderService.getOrder(req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  res.json({ success: true, data: order });
});

router.get('/:orderId/weight-chain', (req, res) => {
  const weightChain = orderService.getOrderWeightChain(req.params.orderId);
  if (!weightChain) {
    return res.status(404).json({ success: false, error: '订单不存在' });
  }
  res.json({ success: true, data: weightChain });
});

router.post('/:orderId/confirm-delivery', (req, res) => {
  try {
    const { deliveryTime } = req.body;
    const order = orderService.confirmDelivery(req.params.orderId, deliveryTime);
    res.json({
      success: true,
      data: {
        orderId: order.id,
        status: order.status,
        deliveryTime: order.deliveryTime
      }
    });
  } catch (error) {
    logger.error('确认配送失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:orderId/weight-confirmation', (req, res) => {
  try {
    const { itemId, actualWeight, photoUrl, operatorId, operatorName } = req.body;
    const order = orderService.addWeightConfirmation(
      req.params.orderId,
      itemId,
      actualWeight,
      photoUrl,
      operatorId,
      operatorName
    );
    res.json({
      success: true,
      data: {
        orderId: order.id,
        itemId,
        actualWeight,
        weightConfirmations: order.weightConfirmations
      }
    });
  } catch (error) {
    logger.error('添加称重确认失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:orderId/leader-confirm', (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;
    const order = orderService.leaderConfirm(
      req.params.orderId,
      operatorId,
      operatorName
    );
    res.json({
      success: true,
      data: {
        orderId: order.id,
        leaderConfirmed: order.leaderConfirmed,
        leaderConfirmTime: order.leaderConfirmTime
      }
    });
  } catch (error) {
    logger.error('团长确认失败', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
