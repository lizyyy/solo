const express = require('express');
const router = express.Router();
const manualCorrectionService = require('../services/manualCorrectionService');

router.post('/', (req, res) => {
  try {
    const correction = manualCorrectionService.createCorrection(req.body);
    res.json({
      success: true,
      data: correction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/', (req, res) => {
  try {
    const filters = {
      correction_type: req.query.correction_type,
      target_table: req.query.target_table,
      corrected_by: req.query.corrected_by,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };
    const corrections = manualCorrectionService.getCorrections(filters);
    res.json({
      success: true,
      data: corrections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const correction = manualCorrectionService.getCorrectionById(req.params.id);
    if (!correction) {
      return res.status(404).json({
        success: false,
        error: '修正记录不存在'
      });
    }
    res.json({
      success: true,
      data: correction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/target/:table/:recordId', (req, res) => {
  try {
    const corrections = manualCorrectionService.getCorrectionsByRecord(
      req.params.table,
      req.params.recordId
    );
    res.json({
      success: true,
      data: corrections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
