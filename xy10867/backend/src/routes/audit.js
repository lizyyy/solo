const express = require('express');
const AuditService = require('../services/auditService');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await AuditService.getAllLogs();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
