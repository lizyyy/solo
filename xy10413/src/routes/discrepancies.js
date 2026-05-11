const express = require('express');
const router = express.Router();
const DiscrepancyService = require('../services/DiscrepancyService');

router.post('/handle', async (req, res) => {
  try {
    const { inspectionResultId, handlingType, quantity, notes, requiresApproval } = req.body;
    const result = await DiscrepancyService.createHandling(
      inspectionResultId,
      handlingType,
      quantity,
      notes,
      requiresApproval !== false
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const { approverId, approverName, approved, notes } = req.body;
    const result = await DiscrepancyService.approve(
      req.params.id,
      approverId,
      approverName,
      approved,
      notes
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/pending', async (req, res) => {
  try {
    const pending = await DiscrepancyService.listPending();
    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/supplier-statistics', async (req, res) => {
  try {
    const supplierId = req.query.supplierId;
    const stats = await DiscrepancyService.getSupplierStatistics(supplierId);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/audit-trail/:inspectionResultId', async (req, res) => {
  try {
    const trail = await DiscrepancyService.getAuditTrail(req.params.inspectionResultId);
    if (!trail) {
      return res.status(404).json({ success: false, message: '未找到审计记录' });
    }
    res.json({ success: true, data: trail });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/can-stock-in/:inspectionResultId', async (req, res) => {
  try {
    const result = await DiscrepancyService.canStockIn(req.params.inspectionResultId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
