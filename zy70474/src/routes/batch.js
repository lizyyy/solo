const express = require('express');
const router = express.Router();
const batchService = require('../services/batch');

router.post('/rerun/preview', async (req, res) => {
  try {
    const filters = req.body;
    const result = await batchService.previewRerun(filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/rerun/execute', async (req, res) => {
  try {
    const { filters, operator } = req.body;
    
    if (!operator) {
      return res.status(400).json({
        success: false,
        error: '操作人为必填项'
      });
    }

    const result = await batchService.executeRerun(filters, operator);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/fix-signature/:detailId', async (req, res) => {
  try {
    const { detailId } = req.params;
    const { newAlgorithm, newSignature, operator } = req.body;

    if (!newAlgorithm || !newSignature || !operator) {
      return res.status(400).json({
        success: false,
        error: 'newAlgorithm、newSignature、operator为必填项'
      });
    }

    const result = await batchService.fixSignature(detailId, newAlgorithm, newSignature, operator);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;