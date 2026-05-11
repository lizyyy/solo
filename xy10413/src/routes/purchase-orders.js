const express = require('express');
const router = express.Router();
const PurchaseOrderService = require('../services/PurchaseOrderService');

router.post('/', async (req, res) => {
  try {
    const createdBy = req.headers['x-user-id'] || 'system';
    const po = await PurchaseOrderService.create(req.body, createdBy);
    res.status(201).json({ success: true, data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.supplierId) filters.supplierId = req.query.supplierId;

    const pos = await PurchaseOrderService.list(filters);
    res.json({ success: true, data: pos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    let po;
    if (req.params.id.length === 36) {
      po = await PurchaseOrderService.findById(req.params.id);
    } else {
      po = await PurchaseOrderService.findByPoNo(req.params.id);
    }
    
    if (!po) {
      return res.status(404).json({ success: false, message: '采购单不存在' });
    }
    res.json({ success: true, data: po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
