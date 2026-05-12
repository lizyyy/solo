const express = require('express');
const router = express.Router();
const propertyService = require('../services/propertyService');
const reportService = require('../services/reportService');
const { getStatusHistory, getManualCorrections } = require('../utils');

router.get('/', (req, res) => {
  try {
    const { project_id, status } = req.query;
    const properties = propertyService.listProperties(project_id, status);
    res.json({ success: true, data: properties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const property = propertyService.getProperty(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, error: '房源不存在' });
    }
    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/timeline', (req, res) => {
  try {
    const timeline = reportService.getPropertyTimelineReport(req.params.id);
    if (!timeline) {
      return res.status(404).json({ success: false, error: '房源不存在' });
    }
    res.json({ success: true, data: timeline });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const history = getStatusHistory('property', req.params.id);
    const corrections = getManualCorrections('property', req.params.id);
    res.json({ success: true, data: { history, manual_corrections: corrections } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const property = propertyService.createProperty(req.body);
    res.status(201).json({ success: true, data: property });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
