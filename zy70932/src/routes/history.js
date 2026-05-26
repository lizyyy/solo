const express = require('express');
const router = express.Router();
const { queryHistory, exportDetails, getRectificationTrace } = require('../services/historyService');

router.get('/', (req, res) => {
  try {
    const filters = {};
    if (req.query.site_node) filters.site_node = req.query.site_node;
    if (req.query.supervisor_signature) filters.supervisor_signature = req.query.supervisor_signature;
    if (req.query.rectification_count_min !== undefined) filters.rectification_count_min = parseInt(req.query.rectification_count_min, 10);
    if (req.query.rectification_count_max !== undefined) filters.rectification_count_max = parseInt(req.query.rectification_count_max, 10);
    if (req.query.status) filters.status = req.query.status;
    if (req.query.batch_id) filters.batch_id = req.query.batch_id;

    const result = queryHistory(filters);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', (req, res) => {
  try {
    const filters = {};
    if (req.query.site_node) filters.site_node = req.query.site_node;
    if (req.query.supervisor_signature) filters.supervisor_signature = req.query.supervisor_signature;
    if (req.query.rectification_count_min !== undefined) filters.rectification_count_min = parseInt(req.query.rectification_count_min, 10);
    if (req.query.rectification_count_max !== undefined) filters.rectification_count_max = parseInt(req.query.rectification_count_max, 10);
    if (req.query.status) filters.status = req.query.status;
    if (req.query.batch_id) filters.batch_id = req.query.batch_id;

    const result = exportDetails(filters);

    if (req.query.format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="records_export.json"');
      res.json(result);
    } else {
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/trace', (req, res) => {
  try {
    const result = getRectificationTrace(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;