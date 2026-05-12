const express = require('express');
const router = express.Router();
const core = require('../services/core');

router.get('/wave/:waveId', (req, res) => {
  try {
    const report = core.generateWaveReport(req.params.waveId);
    if (!report) {
      return res.status(404).json({ success: false, error: '波次不存在' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/stockouts', (req, res) => {
  try {
    const report = core.generateStockoutReport(req.query);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/order-hierarchy/:orderId', (req, res) => {
  try {
    const report = core.generateOrderHierarchyReport(req.params.orderId);
    if (!report) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/inventory-change/:waveId', (req, res) => {
  try {
    const report = core.generateInventoryChangeReport(req.params.waveId);
    if (!report) {
      return res.status(404).json({ success: false, error: '波次不存在' });
    }
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
