const express = require('express');
const router = express.Router();
const CustomerStoreService = require('../services/CustomerStoreService');

router.post('/', async (req, res) => {
  try {
    const store = await CustomerStoreService.createStore(req.body);
    res.json({
      success: true,
      status: 'completed',
      data: store
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const stores = await CustomerStoreService.getAllStores();
    res.json({
      success: true,
      status: 'completed',
      data: stores
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const store = await CustomerStoreService.getStoreById(req.params.id);
    if (!store) {
      return res.status(404).json({
        success: false,
        status: 'not_found',
        error: '门店不存在'
      });
    }
    res.json({
      success: true,
      status: 'completed',
      data: store
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const store = await CustomerStoreService.updateStore(req.params.id, req.body);
    res.json({
      success: true,
      status: 'completed',
      data: store
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      status: 'failed',
      error: error.message
    });
  }
});

module.exports = router;
