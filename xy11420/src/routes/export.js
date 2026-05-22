const express = require('express');
const exportService = require('../services/export');
const { requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/batch/:id', requirePermission('export_summary'), (req, res) => {
  try {
    const { filePath, fileName } = exportService.exportBatchToCsv(req.params.id);
    res.download(filePath, fileName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batches', requirePermission('export_summary'), (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const { filePath, fileName } = exportService.exportBatchesSummaryToCsv({
      status, startDate, endDate
    });
    res.download(filePath, fileName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/batch/:id/summary', requirePermission('view_batch'), (req, res) => {
  try {
    const summary = exportService.generateBatchSummary(req.params.id);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
