const express = require('express');
const router = express.Router();
const gateSyncService = require('../services/gateSyncService');
const { store, enums } = require('../models/store');

router.post('/sync/:cardId', (req, res) => {
  const { operator } = req.body;
  try {
    const result = gateSyncService.syncCardToGate(req.params.cardId, operator);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/retry-failed', (req, res) => {
  const results = gateSyncService.retryFailedSyncs();
  res.json({
    success: true,
    retried: results.length,
    results
  });
});

router.get('/check-access', (req, res) => {
  const { plate } = req.query;
  if (!plate) {
    return res.status(400).json({ success: false, error: '缺少车牌参数' });
  }
  const result = gateSyncService.checkPlateAccess(plate);
  res.json({ success: true, ...result });
});

router.get('/status', (req, res) => {
  res.json({
    success: true,
    gateStatus: store.gateStatus,
    totalPlates: Object.keys(store.gateStatus).length,
    allowedCount: Object.values(store.gateStatus).filter(s => s.allowed).length
  });
});

router.get('/failed-syncs', (req, res) => {
  const failed = gateSyncService.getAllFailedSyncs();
  res.json({
    success: true,
    count: failed.length,
    failedSyncs: failed
  });
});

router.get('/sync-history/:cardId', (req, res) => {
  const history = gateSyncService.getSyncHistory(req.params.cardId);
  res.json({
    success: true,
    count: history.length,
    history
  });
});

module.exports = router;
