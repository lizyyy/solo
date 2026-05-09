const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');

router.get('/', (req, res) => {
  const { assetId } = req.query;
  const records = inventoryService.getInventoryRecords(assetId);
  
  res.json({
    success: true,
    data: records
  });
});

router.get('/summary', (req, res) => {
  const summary = inventoryService.getInventorySummary();
  
  res.json({
    success: true,
    data: summary
  });
});

router.post('/', (req, res) => {
  const { assetId, status, remark, recordedBy } = req.body;
  const record = inventoryService.recordInventory(assetId, status, remark, recordedBy);
  
  res.status(201).json({
    success: true,
    data: record
  });
});

module.exports = router;
