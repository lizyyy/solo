const express = require('express');
const router = express.Router();

const auditService = require('../services/auditService');

router.get('/', async (req, res) => {
  try {
    const logs = await auditService.getAllLogs();
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/contract/:contractId', async (req, res) => {
  try {
    const logs = await auditService.getLogsByContractId(req.params.contractId);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batch/:batchId', async (req, res) => {
  try {
    const logs = await auditService.getLogsByBatchId(req.params.batchId);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/action/:actionType', async (req, res) => {
  try {
    const logs = await auditService.getLogsByActionType(req.params.actionType);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
