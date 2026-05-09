const express = require('express');
const { authMiddleware } = require('./auth');
const inventoryService = require('../services/inventoryService');
const db = require('../models');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { storeId, productId, lowStock, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const result = await inventoryService.getInventory({
      storeId,
      productId,
      lowStock: lowStock === 'true',
      limit: parseInt(limit),
      offset
    });

    res.json({
      success: true,
      data: {
        rows: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: result.count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const inventory = await inventoryService.getInventoryById(req.params.id);
    
    if (!inventory) {
      return res.status(404).json({ success: false, message: '库存记录不存在' });
    }

    res.json({ success: true, data: inventory });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const requestId = req.headers['x-request-id'];
    if (!requestId) {
      return res.status(400).json({ success: false, message: '缺少请求ID' });
    }

    const result = await inventoryService.createInventory(
      req.body,
      req.user.id,
      requestId
    );

    const statusCode = result.isDuplicate ? 200 : 201;
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/adjust', async (req, res, next) => {
  try {
    const requestId = req.headers['x-request-id'];
    if (!requestId) {
      return res.status(400).json({ success: false, message: '缺少请求ID' });
    }

    const result = await inventoryService.adjustInventory(
      req.params.id,
      req.body,
      req.user.id,
      requestId
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/price', async (req, res, next) => {
  try {
    const requestId = req.headers['x-request-id'];
    if (!requestId) {
      return res.status(400).json({ success: false, message: '缺少请求ID' });
    }

    const { price, reason } = req.body;

    if (price === undefined) {
      return res.status(400).json({ success: false, message: '缺少价格参数' });
    }

    const result = await inventoryService.updatePrice(
      req.params.id,
      price,
      reason,
      req.user.id,
      requestId
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/transfer', async (req, res, next) => {
  try {
    const requestId = req.headers['x-request-id'];
    if (!requestId) {
      return res.status(400).json({ success: false, message: '缺少请求ID' });
    }

    const result = await inventoryService.transferStock(
      req.body,
      req.user.id,
      requestId
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/snapshots', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const snapshots = await db.InventorySnapshot.findAndCountAll({
      where: { inventoryId: req.params.id },
      order: [['snapshotAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        rows: snapshots.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: snapshots.count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
