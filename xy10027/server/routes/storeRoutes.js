const express = require('express');
const StoreService = require('../services/storeService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const stores = await StoreService.getAllStores(req.query);
    
    res.status(200).json({
      stores,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting stores:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/:storeId', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await StoreService.getStoreById(storeId);
    
    if (!store) {
      return res.status(404).json({
        error: 'Store not found',
        requestId: req.requestId
      });
    }
    
    res.status(200).json({
      store,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting store:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const storeData = req.body;
    
    const newStore = await StoreService.createStore(
      storeData,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(201).json({
      store: newStore,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error creating store:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.put('/:storeId', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    const updateData = req.body;
    
    const updatedStore = await StoreService.updateStore(
      storeId,
      updateData,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      store: updatedStore,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error updating store:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

module.exports = router;
