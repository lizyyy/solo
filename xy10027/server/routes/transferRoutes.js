const express = require('express');
const TransferService = require('../services/transferService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {
      fromStoreId: req.query.fromStoreId,
      toStoreId: req.query.toStoreId,
      status: req.query.status,
      limit: req.query.limit ? parseInt(req.query.limit) : null
    };
    
    const orders = await TransferService.getTransferOrders(filters);
    
    res.status(200).json({
      orders,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting transfer orders:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/:orderId', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await TransferService.getTransferOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        error: 'Transfer order not found',
        requestId: req.requestId
      });
    }
    
    const items = await TransferService.getTransferOrderItems(orderId);
    
    res.status(200).json({
      order,
      items,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting transfer order:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const orderData = req.body;
    
    const newOrder = await TransferService.createTransferOrder(
      orderData,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(201).json({
      order: newOrder,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error creating transfer order:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:orderId/submit', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const updatedOrder = await TransferService.submitTransferOrder(
      orderId,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      order: updatedOrder,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error submitting transfer order:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:orderId/approve', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const updatedOrder = await TransferService.approveTransferOrder(
      orderId,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      order: updatedOrder,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error approving transfer order:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:orderId/reject', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { rejectReason } = req.body;
    
    const updatedOrder = await TransferService.rejectTransferOrder(
      orderId,
      rejectReason,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      order: updatedOrder,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error rejecting transfer order:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:orderId/ship', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { items } = req.body;
    
    const updatedOrder = await TransferService.shipTransferOrder(
      orderId,
      items,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      order: updatedOrder,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error shipping transfer order:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:orderId/receive', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { items } = req.body;
    
    const updatedOrder = await TransferService.receiveTransferOrder(
      orderId,
      items,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      order: updatedOrder,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error receiving transfer order:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

module.exports = router;
