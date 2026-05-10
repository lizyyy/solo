const express = require('express');
const router = express.Router();
const ExportService = require('../services/ExportService');

router.post('/authorization-list', async (req, res) => {
  try {
    const { materialId } = req.body;
    const exportService = new ExportService();
    
    const result = await exportService.exportAuthorizationList(materialId);

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

router.post('/removal-audit', async (req, res) => {
  try {
    const { materialId } = req.body;
    const exportService = new ExportService();
    
    const result = await exportService.exportRemovalAudit(materialId);

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

router.post('/rule-history/:authorizationId', async (req, res) => {
  try {
    const exportService = new ExportService();
    
    const result = await exportService.exportRuleEvaluationHistory(req.params.authorizationId);

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
