const express = require('express');
const router = express.Router();
const { getAuditLogsByTaskId, getAuditLogsByBatchId } = require('../services/auditService');

router.get('/task/:taskId', async (req, res) => {
  try {
    const logs = await getAuditLogsByTaskId(req.params.taskId);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

router.get('/batch/:batchId', async (req, res) => {
  try {
    const logs = await getAuditLogsByBatchId(req.params.batchId);
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;
