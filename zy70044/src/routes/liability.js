const express = require('express');
const router = express.Router();
const liabilityService = require('../services/liability-service');
const exportService = require('../services/export-service');
const { formatDate } = require('../utils');

router.post('/freeze', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const { repair_order_id, responsibility, reason } = req.body;
    
    if (!repair_order_id || !responsibility) {
      return res.status(400).json({ success: false, error: '返修单ID和责任方不能为空' });
    }

    const result = liabilityService.freezeLiability(repair_order_id, responsibility, reason, operator);
    res.status(201).json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/unfreeze', (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'api_user';
    const { repair_order_id } = req.body;
    
    if (!repair_order_id) {
      return res.status(400).json({ success: false, error: '返修单ID不能为空' });
    }

    const result = liabilityService.unfreezeLiability(repair_order_id, operator);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/active/:orderId', (req, res) => {
  try {
    const freeze = liabilityService.getActiveFreeze(req.params.orderId);
    res.json({ success: true, data: freeze });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/history/:orderId', (req, res) => {
  try {
    const freezes = liabilityService.getFreezeHistory(req.params.orderId);
    res.json({ success: true, data: freezes });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/history/:orderId/export', (req, res) => {
  try {
    const freezes = liabilityService.getFreezeHistory(req.params.orderId);
    const csv = exportService.exportLiabilityHistoryToCSV(freezes);
    const filename = `责任冻结历史_${formatDate(Date.now()).replace(/[/:]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

module.exports = router;
