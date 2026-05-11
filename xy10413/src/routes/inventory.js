const express = require('express');
const router = express.Router();
const InventoryService = require('../services/InventoryService');

router.post('/stock-in/:arrivalNoteId', async (req, res) => {
  try {
    const createdBy = req.headers['x-user-id'] || 'system';
    const { location } = req.body;
    const result = await InventoryService.stockIn(
      req.params.arrivalNoteId,
      createdBy,
      location
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.productCode) filters.productCode = req.query.productCode;
    if (req.query.spec) filters.spec = req.query.spec;

    const inventory = await InventoryService.getInventory(filters);
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const filters = {};
    if (req.query.referenceId) filters.referenceId = req.query.referenceId;
    if (req.query.type) filters.type = req.query.type;

    const logs = await InventoryService.getInventoryLog(filters);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
