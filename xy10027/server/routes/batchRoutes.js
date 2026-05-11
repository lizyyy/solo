const express = require('express');
const BatchService = require('../services/batchService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/store/:storeId', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    const filters = {
      status: req.query.status,
      productId: req.query.productId,
      expiringSoon: req.query.expiringSoon === 'true',
      expired: req.query.expired === 'true'
    };
    
    const batches = await BatchService.getBatchesByStore(storeId, filters);
    
    res.status(200).json({
      batches,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting batches:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/store/:storeId/inventory', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    const filters = {
      hasExpiring: req.query.hasExpiring === 'true',
      hasExpired: req.query.hasExpired === 'true'
    };
    
    const inventory = await BatchService.getStoreInventory(storeId, filters);
    
    res.status(200).json({
      inventory,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting store inventory:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/store/:storeId/expiring', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    const daysThreshold = parseInt(req.query.days) || 30;
    
    const batches = await BatchService.getExpiringBatches(storeId, daysThreshold);
    
    res.status(200).json({
      batches,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting expiring batches:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/store/:storeId/expired', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    
    const batches = await BatchService.getExpiredBatches(storeId);
    
    res.status(200).json({
      batches,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting expired batches:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/:batchId', authMiddleware, async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await BatchService.getBatchById(batchId);
    
    if (!batch) {
      return res.status(404).json({
        error: 'Batch not found',
        requestId: req.requestId
      });
    }
    
    res.status(200).json({
      batch,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting batch:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const batchData = req.body;
    
    const newBatch = await BatchService.createBatch(
      batchData,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(201).json({
      batch: newBatch,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error creating batch:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:batchId/adjust', authMiddleware, async (req, res) => {
  try {
    const { batchId } = req.params;
    const { quantityChange, reason } = req.body;
    
    const updatedBatch = await BatchService.updateBatchQuantity(
      batchId,
      quantityChange,
      reason,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      batch: updatedBatch,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error adjusting batch quantity:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

module.exports = router;
