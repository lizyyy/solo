const express = require('express');
const router = express.Router();
const { AuditService } = require('../services');

router.get('/operator/:operator', async (req, res) => {
  try {
    const { limit } = req.query;
    const history = await AuditService.getOperatorHistory(req.params.operator, limit ? parseInt(limit) : 100);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const history = await AuditService.getEntityAuditTrail(req.params.entityType, req.params.entityId);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
