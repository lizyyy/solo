const express = require('express');
const inventoryService = require('../services/inventoryService');
const csvService = require('../services/csvService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const productCode = req.query.product_code || null;
    const batchNo = req.query.batch_no || null;
    
    const inventory = await inventoryService.getInventory(productCode, batchNo);
    
    res.json({
      success: true,
      data: inventory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const productCode = req.query.product_code || null;
    const batchNo = req.query.batch_no || null;
    const limit = parseInt(req.query.limit) || 100;
    
    const transactions = await inventoryService.getInventoryTransactions(productCode, batchNo, limit);
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const summary = await inventoryService.getInventorySummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/export', async (req, res) => {
  try {
    const format = req.query.format || 'json';
    
    const inventory = await csvService.exportInventory(format);
    
    if (format === 'json') {
      res.json({
        success: true,
        data: inventory
      });
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
      res.send('\uFEFF' + inventory);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
