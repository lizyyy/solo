const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { InventoryService, ERROR_TYPES } = require('./inventoryService');

const router = express.Router();
const inventoryService = new InventoryService();

router.get('/inventory/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const inventory = await inventoryService.getInventory(productId);
    if (!inventory) {
      return res.status(404).json({
        success: false,
        errorType: ERROR_TYPES.NOT_FOUND,
        errorMessage: `商品 ${productId} 不存在`
      });
    }
    res.json({
      success: true,
      data: inventory
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      errorMessage: err.message
    });
  }
});

router.post('/inventory/init', async (req, res) => {
  try {
    const { productId, totalStock } = req.body;
    if (!productId || !totalStock) {
      return res.status(400).json({
        success: false,
        errorMessage: '缺少 productId 或 totalStock'
      });
    }
    const result = await inventoryService.createInventory(productId, totalStock);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      errorMessage: err.message
    });
  }
});

router.post('/orders/lock', async (req, res) => {
  try {
    const { orderId, productId, userId, quantity } = req.body;
    if (!orderId || !productId || !userId || !quantity) {
      return res.status(400).json({
        success: false,
        errorMessage: '缺少必要参数: orderId, productId, userId, quantity'
      });
    }
    const result = await inventoryService.lockStock(productId, orderId, userId, quantity);
    if (!result.success) {
      const statusMap = {
        [ERROR_TYPES.INSUFFICIENT_STOCK]: 409,
        [ERROR_TYPES.DUPLICATE_REQUEST]: 409,
        [ERROR_TYPES.STATUS_CONFLICT]: 409,
        [ERROR_TYPES.NOT_FOUND]: 404
      };
      return res.status(statusMap[result.errorType] || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      errorMessage: err.message
    });
  }
});

router.post('/orders/pay', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({
        success: false,
        errorMessage: '缺少 orderId'
      });
    }
    const result = await inventoryService.confirmPayment(orderId);
    if (!result.success) {
      const statusMap = {
        [ERROR_TYPES.STATUS_CONFLICT]: 409,
        [ERROR_TYPES.TIMEOUT]: 409,
        [ERROR_TYPES.NOT_FOUND]: 404
      };
      return res.status(statusMap[result.errorType] || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      errorMessage: err.message
    });
  }
});

router.post('/orders/cancel', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({
        success: false,
        errorMessage: '缺少 orderId'
      });
    }
    const result = await inventoryService.cancelOrder(orderId);
    if (!result.success) {
      const statusMap = {
        [ERROR_TYPES.STATUS_CONFLICT]: 409,
        [ERROR_TYPES.NOT_FOUND]: 404
      };
      return res.status(statusMap[result.errorType] || 400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      errorMessage: err.message
    });
  }
});

router.post('/orders/timeout', async (req, res) => {
  try {
    const results = await inventoryService.closeTimeoutOrders();
    res.json({
      success: true,
      data: {
        processed: results.length,
        results
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      errorMessage: err.message
    });
  }
});

router.get('/compensation/report', async (req, res) => {
  try {
    const report = await inventoryService.getCompensationReport();
    res.json({
      success: true,
      data: report
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      errorMessage: err.message
    });
  }
});

router.post('/compensation/log', async (req, res) => {
  try {
    const { compensationId, orderId, action, status, details } = req.body;
    if (!compensationId || !orderId || !action || !status) {
      return res.status(400).json({
        success: false,
        errorMessage: '缺少必要参数: compensationId, orderId, action, status'
      });
    }
    const result = await inventoryService.logCompensation(compensationId, orderId, action, status, details);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      errorMessage: err.message
    });
  }
});

module.exports = router;
