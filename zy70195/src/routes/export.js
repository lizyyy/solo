const express = require('express');
const router = express.Router();
const exportService = require('../services/export-service');
const path = require('path');

router.get('/qualifications', async (req, res) => {
  try {
    const result = await exportService.exportQualificationReview();
    res.json({ 
      success: true, 
      data: {
        filepath: result.filepath,
        filename: result.filename,
        summary: result.summary
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/freeze-logs', async (req, res) => {
  try {
    const result = await exportService.exportFreezeReview();
    res.json({ 
      success: true, 
      data: {
        filepath: result.filepath,
        filename: result.filename,
        summary: result.summary
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const result = await exportService.exportOrderReview();
    res.json({ 
      success: true, 
      data: {
        filepath: result.filepath,
        filename: result.filename,
        summary: result.summary
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/risks', async (req, res) => {
  try {
    const result = await exportService.exportRiskReview();
    res.json({ 
      success: true, 
      data: {
        filepath: result.filepath,
        filename: result.filename,
        summary: result.summary
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/exceptions', async (req, res) => {
  try {
    const result = await exportService.exportExceptionReview();
    res.json({ 
      success: true, 
      data: {
        filepath: result.filepath,
        filename: result.filename,
        summary: result.summary
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/full', async (req, res) => {
  try {
    const result = await exportService.exportFullReview();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
